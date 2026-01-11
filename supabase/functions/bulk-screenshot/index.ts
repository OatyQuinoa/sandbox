import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BulkScreenshotRequest {
  urls: string[];
}

interface BulkResponse {
  url: string;
  response: {
    is_successful: boolean;
    status: number;
    statusText: string;
    body?: { error_code: string; error_message: string };
  };
}

interface ScreenshotOneResponse {
  responses: BulkResponse[];
}

interface ErrorResponse {
  error: string;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeFilename(url: string): string {
  try {
    const parsed = new URL(url);
    let filename = parsed.hostname + parsed.pathname;
    filename = filename.replace(/[^a-zA-Z0-9-_]/g, "_");
    filename = filename.substring(0, 100);
    return filename || "screenshot";
  } catch {
    return "screenshot";
  }
}

// Strip consent-related query parameters that trigger cookie banners
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const consentParams = [
      "consent-modal",
      "consent",
      "cookie-consent",
      "gdpr",
      "privacy",
      "show-consent",
      "showConsent",
      "consent_modal",
      "cookie_consent",
    ];
    
    consentParams.forEach((param) => {
      parsed.searchParams.delete(param);
    });
    
    return parsed.toString();
  } catch {
    return url;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" } as ErrorResponse),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("SCREENSHOTONE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Screenshot service not configured" } as ErrorResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: BulkScreenshotRequest = await req.json();

    if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "URLs array is required" } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (body.urls.length > 20) {
      return new Response(
        JSON.stringify({ error: "Maximum 20 URLs allowed per request" } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const invalidUrls = body.urls.filter((url) => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      return new Response(
        JSON.stringify({ error: `Invalid URLs: ${invalidUrls.join(", ")}` } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sanitize URLs to remove consent-related query parameters
    const cleanUrls = body.urls.map((url) => sanitizeUrl(url));

    // Custom script to remove cookie banners
    const bannerRemovalScript = `
      // Remove common cookie banner elements
      const selectors = [
        '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]', '[class*="privacy"]',
        '[id*="cookie"]', '[id*="consent"]', '[id*="gdpr"]', '[id*="privacy"]',
        '[aria-label*="cookie"]', '[aria-label*="consent"]', '[aria-label*="privacy"]',
        '.cc-window', '.cc-banner', '#onetrust-consent-sdk', '.onetrust-pc-dark-filter',
        '[class*="CookieConsent"]', '[class*="PrivacyModal"]', '[class*="ConsentModal"]',
        '[data-testid*="cookie"]', '[data-testid*="consent"]',
        'div[role="dialog"][aria-modal="true"]'
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.remove();
        });
      });
      // Remove fixed/sticky overlays that might be consent banners
      document.querySelectorAll('*').forEach(el => {
        const style = getComputedStyle(el);
        if ((style.position === 'fixed' || style.position === 'sticky') && 
            (style.zIndex > 999 || el.getAttribute('role') === 'dialog')) {
          const text = el.innerText?.toLowerCase() || '';
          if (text.includes('cookie') || text.includes('consent') || text.includes('privacy') || 
              text.includes('accept') || text.includes('agree') || text.includes('gdpr')) {
            el.remove();
          }
        }
      });
      // Reset body overflow in case it was locked by a modal
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    `;

    const bulkRequestBody = {
      access_key: apiKey,
      execute: true,
      optimize: true,
      options: {
        viewport_width: 1280,
        viewport_height: 800,
        format: "png",
        cache: false, // Disable cache to ensure fresh screenshots with banner blocking
        block_cookie_banners: true, // Block cookie banners for cleaner screenshots
        block_banners_by_heuristics: true, // Use heuristics to block banners that standard method misses
        block_ads: true, // Block ads for cleaner screenshots
        delay: 2, // Wait 2 seconds for page to fully load
        scripts: bannerRemovalScript,
      },
      requests: cleanUrls.map((url) => ({ url })),
    };

    const bulkResponse = await fetch("https://api.screenshotone.com/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bulkRequestBody),
    });

    if (!bulkResponse.ok) {
      const errorText = await bulkResponse.text();
      console.error("ScreenshotOne bulk API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process bulk screenshots" } as ErrorResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bulkData: BulkResponse[] = await bulkResponse.json();

    const zip = new JSZip();
    const results: { url: string; filename: string; success: boolean; error?: string }[] = [];

    const downloadPromises = bulkData.map(async (item, index) => {
      const originalUrl = body.urls[index];
      const filename = `${sanitizeFilename(originalUrl)}_${index + 1}.png`;

      if (item.response && item.response.is_successful) {
        try {
          const imageResponse = await fetch(item.url);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            zip.file(filename, imageBuffer);
            results.push({ url: originalUrl, filename, success: true });
          } else {
            results.push({ url: originalUrl, filename, success: false, error: "Failed to download image" });
          }
        } catch (err) {
          results.push({ url: originalUrl, filename, success: false, error: String(err) });
        }
      } else {
        const errorMsg = item.response?.body?.error_message || "Screenshot failed";
        results.push({ url: originalUrl, filename, success: false, error: errorMsg });
      }
    });

    await Promise.all(downloadPromises);

    const manifestContent = results.map((r) => {
      if (r.success) {
        return `${r.url} -> ${r.filename}`;
      } else {
        return `${r.url} -> FAILED: ${r.error}`;
      }
    }).join("\n");
    zip.file("manifest.txt", manifestContent);

    const zipBlob = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="screenshots_${Date.now()}.zip"`,
      },
    });
  } catch (error) {
    console.error("Bulk screenshot function error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process bulk screenshots" } as ErrorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
