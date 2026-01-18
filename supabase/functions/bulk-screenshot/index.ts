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

interface ScreenshotOneResponse {
  responses: {
    url: string;
    response: {
      is_successful: boolean;
      status: number;
      statusText: string;
      body?: { error_code: string; error_message: string };
    };
  }[];
}

/**
 * ENHANCED BANNER KILLER
 * This runs AFTER ScreenshotOne's built-in blocking
 * Handles custom implementations like Lego.com
 */
const ENHANCED_BANNER_KILLER = `
(function() {
  // Kill function - removes elements and restores scroll
  const kill = () => {
    // 1. OneTrust (most common - ScreenshotOne should handle, but backup)
    const oneTrustSelectors = [
      '#onetrust-banner-sdk',
      '#onetrust-consent-sdk', 
      '#onetrust-pc-sdk',
      '.onetrust-pc-dark-filter',
      'div[class*="onetrust"]'
    ];
    
    // 2. CookieBot
    const cookieBotSelectors = [
      '#CybotCookiebotDialog',
      '#CookiebotWidget',
      '.CookieConsent',
      'div[id*="Cookiebot"]'
    ];
    
    // 3. Custom implementations (like Lego)
    const customSelectors = [
      // Cookie modals
      'div[class*="cookie"][class*="banner"]',
      'div[class*="cookie"][class*="modal"]',
      'div[class*="cookie"][class*="consent"]',
      'div[id*="cookie"][id*="banner"]',
      'div[id*="cookie"][id*="modal"]',
      'div[aria-label*="cookie" i]',
      'div[role="dialog"][class*="cookie"]',
      
      // Generic modals with "accept" text
      'div[role="dialog"]:has(button:contains("Accept"))',
      
      // Overlays (high z-index elements covering page)
      'div[style*="position: fixed"][style*="z-index"]',
      
      // GDPR/Privacy specific
      'div[class*="gdpr"]',
      'div[class*="privacy"][class*="notice"]',
      'div[id*="privacy"][id*="notice"]',
    ];
    
    // Combine all selectors
    const allSelectors = [
      ...oneTrustSelectors,
      ...cookieBotSelectors,
      ...customSelectors
    ];
    
    // Remove elements
    let removedCount = 0;
    allSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Check if element is likely a banner (has buttons, text about cookies/privacy)
          const text = el.textContent?.toLowerCase() || '';
          const hasAcceptButton = el.querySelector('button, a, [role="button"]');
          const isCookieRelated = text.includes('cookie') || 
                                   text.includes('privacy') || 
                                   text.includes('consent') ||
                                   text.includes('gdpr') ||
                                   text.includes('accept');
          
          if (isCookieRelated || hasAcceptButton) {
            el.remove();
            removedCount++;
          }
        });
      } catch (e) {
        // Ignore selector errors
      }
    });
    
    // Remove backdrop/overlays (elements that cover the page)
    document.querySelectorAll('div').forEach(el => {
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex);
      const position = style.position;
      
      // High z-index fixed/absolute elements covering viewport
      if ((position === 'fixed' || position === 'absolute') && 
          zIndex > 999 && 
          el.offsetWidth > window.innerWidth * 0.5 &&
          el.offsetHeight > window.innerHeight * 0.5) {
        
        // Check if it's a cookie/modal element
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('cookie') || 
            text.includes('privacy') || 
            text.includes('consent') ||
            text.length < 1000) { // Empty overlays
          el.remove();
          removedCount++;
        }
      }
    });
    
    // Restore scroll on body and html
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.position = '';
    
    // Remove overflow hidden from any parent elements
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.overflow === 'hidden' && el !== document.body) {
        el.style.overflow = 'visible';
      }
    });
    
    console.log('[Banner Killer] Removed', removedCount, 'elements');
    return removedCount;
  };
  
  // Run immediately
  kill();
  
  // Run again after short delays (catch late-loading banners)
  setTimeout(kill, 100);
  setTimeout(kill, 500);
  setTimeout(kill, 1000);
  
  // Watch for new banners being added to DOM
  const observer = new MutationObserver(() => {
    kill();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Stop observing after 3 seconds
  setTimeout(() => observer.disconnect(), 3000);
})();
`;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("SCREENSHOTONE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Screenshot service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: BulkScreenshotRequest = await req.json();

    if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
      return new Response(JSON.stringify({ error: "URLs array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.urls.length > 20) {
      return new Response(
        JSON.stringify({ error: "Maximum 20 URLs allowed per request" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const invalidUrls = body.urls.filter((url) => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      return new Response(
        JSON.stringify({ error: `Invalid URLs: ${invalidUrls.join(", ")}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    /**
     * OPTIMIZED CONFIGURATION FOR COOKIE BANNER BLOCKING
     */
    const bulkRequestBody = {
      access_key: apiKey,
      execute: true,
      optimize: true,
      options: {
        // Basic settings
        viewport_width: 1280,
        viewport_height: 800,
        format: "png",
        cache: false,

        // ============================================================
        // COOKIE BANNER BLOCKING (Multi-layered approach)
        // ============================================================
        
        // Layer 1: ScreenshotOne's built-in blocking (handles OneTrust, CookieBot, etc.)
        block_cookie_banners: true,
        block_banners_by_heuristics: true,
        block_ads: true,
        block_chats: true,
        
        // Layer 2: Custom JavaScript for stubborn banners (Lego, custom implementations)
        scripts: ENHANCED_BANNER_KILLER,
        
        // Layer 3: CSS to hide known patterns (backup)
        styles: `
          /* OneTrust */
          #onetrust-banner-sdk,
          #onetrust-consent-sdk,
          #onetrust-pc-sdk,
          .onetrust-pc-dark-filter,
          
          /* CookieBot */
          #CybotCookiebotDialog,
          #CookiebotWidget,
          
          /* Generic patterns */
          [id*="cookie-banner"],
          [id*="cookie-consent"],
          [id*="cookie-notice"],
          [class*="cookie-banner"],
          [class*="cookie-modal"],
          [class*="cookie-consent"],
          [aria-label*="cookie" i],
          
          /* High z-index overlays (likely modals) */
          div[style*="z-index: 9999"],
          div[style*="z-index: 99999"],
          div[style*="z-index: 999999"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          
          /* Ensure body is scrollable */
          body, html {
            overflow: auto !important;
            position: static !important;
          }
        `,

        // ============================================================
        // WAIT STRATEGY (Critical for banner blocking)
        // ============================================================
        
        // Wait for page to be mostly loaded (not too fast, not too slow)
        wait_until: "networkidle2",
        
        // Delay to ensure:
        // 1. Banners have loaded (so they can be blocked)
        // 2. JavaScript has executed
        // 3. Not too slow (costs money)
        delay: 2,
        
        // Timeout protection
        timeout: 15000,
        navigation_timeout: 30,

        // ============================================================
        // BOT DETECTION PREVENTION
        // ============================================================
        
        // Use ScreenshotOne's datacenter proxies to rotate IPs
        ip_country_code: "us",
        
        // Stealth mode (mimics real browser)
        stealth_mode: true,
        
        // Reduce animations (faster + less bot-like rapid scrolling)
        reduce_motion: true,
        
        // Don't fail on minor errors
        ignore_host_errors: true,
        
        // Fail fast if CAPTCHA detected (save money)
        fail_if_content_contains: ["captcha", "cloudflare", "just a moment"],
      },
      requests: body.urls.map((url) => ({ url })),
    };

    const startTime = Date.now();
    console.log(`[Start] Processing ${body.urls.length} URLs...`);

    const bulkResponse = await fetch("https://api.screenshotone.com/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bulkRequestBody),
    });

    if (!bulkResponse.ok) {
      const errorText = await bulkResponse.text();
      console.error("[Error] ScreenshotOne API error:", errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to process screenshots",
          details: errorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const bulkData: ScreenshotOneResponse = await bulkResponse.json();
    const responses = bulkData.responses || [];

    const zip = new JSZip();
    const results: {
      url: string;
      filename: string;
      success: boolean;
      error?: string;
      timing?: number;
    }[] = [];

    // Download all screenshots in parallel
    const downloadPromises = responses.map(async (item, index) => {
      const downloadStart = Date.now();
      const originalUrl = body.urls[index];
      const filename = `${sanitizeFilename(originalUrl)}_${index + 1}.png`;

      if (item.response && item.response.is_successful) {
        try {
          const imageResponse = await fetch(item.url);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            zip.file(filename, imageBuffer);

            const timing = Date.now() - downloadStart;
            results.push({
              url: originalUrl,
              filename,
              success: true,
              timing,
            });
            console.log(`[Success] ${originalUrl} (${timing}ms)`);
          } else {
            results.push({
              url: originalUrl,
              filename,
              success: false,
              error: `HTTP ${imageResponse.status}`,
            });
          }
        } catch (err) {
          results.push({
            url: originalUrl,
            filename,
            success: false,
            error: String(err),
          });
        }
      } else {
        const errorMsg =
          item.response?.body?.error_message || "Screenshot failed";
        results.push({
          url: originalUrl,
          filename,
          success: false,
          error: errorMsg,
        });
        
        // Log CAPTCHA failures
        if (errorMsg.toLowerCase().includes('captcha')) {
          console.warn(`[CAPTCHA Detected] ${originalUrl} - Consider using proxy`);
        }
      }
    });

    await Promise.all(downloadPromises);

    const totalTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const avgTime =
      results.filter((r) => r.timing).reduce((a, b) => a + (b.timing || 0), 0) /
        successCount || 0;

    console.log(
      `[Complete] ${successCount}/${results.length} successful in ${totalTime}ms (avg: ${avgTime.toFixed(0)}ms per screenshot)`,
    );

    // Create manifest
    const manifestContent = [
      `Screenshot Batch Report`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `Performance:`,
      `- Total URLs: ${results.length}`,
      `- Successful: ${successCount}`,
      `- Failed: ${results.length - successCount}`,
      `- Total Time: ${totalTime}ms`,
      `- Average Time: ${avgTime.toFixed(0)}ms per screenshot`,
      ``,
      `Configuration:`,
      `- Cookie Banner Blocking: Multi-layered (Built-in + JavaScript + CSS)`,
      `- Wait Strategy: networkidle2`,
      `- Delay: 2s`,
      `- Timeout: 15000ms`,
      `- Bot Prevention: Enabled (IP rotation, stealth mode)`,
      ``,
      `Results:`,
      `--------`,
      ...results.map((r) => {
        if (r.success) {
          return `✓ ${r.url} (${r.timing}ms)\n  → ${r.filename}`;
        } else {
          return `✗ ${r.url}\n  → FAILED: ${r.error}`;
        }
      }),
    ].join("\n");

    zip.file("manifest.txt", manifestContent);

    const zipBlob = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="screenshots_${Date.now()}.zip"`,
        "X-Processing-Time": `${totalTime}ms`,
        "X-Success-Rate": `${((successCount / results.length) * 100).toFixed(0)}%`,
      },
    });
  } catch (error) {
    console.error("[Error]", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process screenshots",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});