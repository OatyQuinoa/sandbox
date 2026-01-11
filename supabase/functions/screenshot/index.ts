import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScreenshotRequest {
  url: string;
}

interface ScreenshotResponse {
  screenshotUrl: string;
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" } as ErrorResponse),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get API key from environment
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

    // Parse request body
    const body: ScreenshotRequest = await req.json();

    // Validate URL
    if (!body.url || typeof body.url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL is required" } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!isValidUrl(body.url)) {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sanitize URL to remove consent-related query parameters
    const cleanUrl = sanitizeUrl(body.url);

    // Construct ScreenshotOne API URL
    const params = new URLSearchParams({
      access_key: apiKey,
      url: cleanUrl,
      viewport_width: "1280",
      viewport_height: "800",
      format: "png",
      cache: "false", // Disable cache to ensure fresh screenshots with banner blocking
      block_cookie_banners: "true", // Block cookie banners for cleaner screenshots
      block_banners_by_heuristics: "true", // Use heuristics to block banners that standard method misses
      block_ads: "true", // Block ads for cleaner screenshots
      delay: "2", // Wait 2 seconds for page to fully load
      scripts: `
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
      `,
    });

    const screenshotUrl = `https://api.screenshotone.com/take?${params.toString()}`;

    // Verify the URL works by doing a HEAD request (optional, removes for speed)
    // You can skip this check if you want faster response times
    // The URL will still work even if we don't verify it

    return new Response(
      JSON.stringify({ screenshotUrl } as ScreenshotResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Screenshot function error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate screenshot" } as ErrorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
