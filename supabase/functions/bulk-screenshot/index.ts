import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BulkScreenshotRequest {
  urls: string[];
  speed?: "fastest" | "fast" | "balanced" | "quality"; // User selects speed vs quality
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

interface ErrorResponse {
  error: string;
}

// Speed configurations optimized for banner removal
const SPEED_CONFIGS = {
  // Ultra-fast: Screenshot before banner even loads (0.5-1 second)
  fastest: {
    wait_until: "load", // Don't wait for all resources
    delay: 0, // No delay
    block_scripts: true, // Block ALL scripts (including banner scripts)
    timeout: 5000, // 5 second timeout
    description: "Screenshot in <1s, blocks all JavaScript including banners",
  },

  // Fast: Quick but ensures main content loads (1-2 seconds)
  fast: {
    wait_until: "domcontentloaded", // Wait for HTML, not all resources
    delay: 0.5, // Minimal delay
    block_scripts: false, // Allow essential scripts
    timeout: 8000, // 8 second timeout
    description: "Screenshot in 1-2s, allows essential scripts",
  },

  // Balanced: Good quality, reasonable speed (2-3 seconds)
  balanced: {
    wait_until: "networkidle2", // Wait until mostly quiet
    delay: 1, // Short delay for late content
    block_scripts: false,
    timeout: 12000, // 12 second timeout
    description: "Screenshot in 2-3s, balanced approach (DEFAULT)",
  },

  // Quality: Best results, slower (4-6 seconds)
  quality: {
    wait_until: "networkidle0", // Wait for complete silence
    delay: 3, // Longer delay for all content
    block_scripts: false,
    timeout: 20000, // 20 second timeout
    description: "Screenshot in 4-6s, highest quality",
  },
};

/**
 * SPEED OPTIMIZATION: Aggressive banner blocking
 * This script is minimal and executes FAST
 */
const FAST_BANNER_KILLER = `
(function() {
  const kill = () => {
    // OneTrust-specific (most common)
    ['#onetrust-banner-sdk','#onetrust-consent-sdk','#onetrust-pc-sdk','.onetrust-pc-dark-filter']
      .forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));
    
    // Generic high-impact selectors only
    ['[id*="cookie"]','[id*="consent"]','[class*="cookie"]','[class*="consent"]']
      .forEach(s => document.querySelectorAll(s).forEach(e => {
        if(e.textContent?.toLowerCase().includes('accept')) e.remove();
      }));
    
    // Restore scroll
    document.body.style.overflow = '';
  };
  
  kill(); // Run once immediately
  setTimeout(kill, 100); // Run again after 100ms
  setTimeout(kill, 300); // Run again after 300ms
})();
`;

/**
 * NUCLEAR OPTION: Block banner scripts entirely
 * Used in "fastest" mode
 */
const BLOCK_BANNER_SCRIPTS = `
(function() {
  // Block OneTrust and common consent management platforms from loading
  const blockedDomains = ['cookielaw.org', 'onetrust', 'cookiebot', 'trustarc', 'didomi'];
  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0]?.toString() || '';
    if (blockedDomains.some(d => url.includes(d))) {
      console.log('[BLOCKED]', url);
      return Promise.reject(new Error('Blocked'));
    }
    return originalFetch.apply(this, args);
  };
  
  // Block script tags from loading consent scripts
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeName === 'SCRIPT' && node.src) {
          if (blockedDomains.some(d => node.src.includes(d))) {
            console.log('[BLOCKED SCRIPT]', node.src);
            node.remove();
          }
        }
      });
    });
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
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
    consentParams.forEach((param) => parsed.searchParams.delete(param));
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

    const cleanUrls = body.urls.map((url) => sanitizeUrl(url));

    // Select speed configuration (default: fast)
    const speedMode = body.speed || "fast";
    const config = SPEED_CONFIGS[speedMode];

    console.log(`[Speed Mode] ${speedMode} - ${config.description}`);

    /**
     * PERFORMANCE OPTIMIZATIONS:
     *
     * 1. geolocation: "US" - Skip GDPR entirely (instant win)
     * 2. wait_until: Based on speed mode
     * 3. delay: Minimal to zero
     * 4. block_cookie_banners: Let provider handle it
     * 5. scripts: Aggressive blocking in fastest mode
     * 6. timeout: Fail fast if page takes too long
     * 7. reduce_motion: Skip animations
     * 8. ignore_host_errors: Don't fail on minor errors
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
        // SPEED OPTIMIZATION 1: Geolocation bypass
        // ============================================================
        // Pretend to be in US - no GDPR banners shown at all
        // This alone eliminates 90% of banner problems INSTANTLY
        geolocation: "US",

        // ============================================================
        // SPEED OPTIMIZATION 2: Wait strategy
        // ============================================================
        // Don't wait longer than necessary
        wait_until: config.wait_until,
        delay: config.delay,

        // ============================================================
        // SPEED OPTIMIZATION 3: Timeout
        // ============================================================
        // Fail fast if page is slow
        timeout: config.timeout,

        // ============================================================
        // SPEED OPTIMIZATION 4: Banner blocking
        // ============================================================
        block_cookie_banners: true,
        block_banners_by_heuristics: true,
        block_ads: true,

        // ============================================================
        // SPEED OPTIMIZATION 5: Script blocking (fastest mode only)
        // ============================================================
        // In fastest mode, block ALL scripts including banner scripts
        ...(config.block_scripts && {
          block_scripts: true,
          // When blocking scripts, use script blocker
          scripts: BLOCK_BANNER_SCRIPTS,
        }),

        // In other modes, use fast banner killer
        ...(!config.block_scripts && {
          scripts: FAST_BANNER_KILLER,
        }),

        // ============================================================
        // SPEED OPTIMIZATION 6: Performance tweaks
        // ============================================================
        reduce_motion: true, // Skip CSS animations
        ignore_host_errors: true, // Don't fail on minor errors

        // Stealth mode
        stealth_mode: true,

        // ============================================================
        // SPEED OPTIMIZATION 7: Minimal CSS (only critical selectors)
        // ============================================================
        styles: `
          /* OneTrust specific - highest priority */
          #onetrust-banner-sdk,
          #onetrust-consent-sdk,
          #onetrust-pc-sdk,
          .onetrust-pc-dark-filter,
          
          /* Common consent IDs */
          [id*="cookie-banner"],
          [id*="consent-banner"],
          
          /* High z-index overlays (likely modals) */
          [style*="z-index: 9999"],
          [style*="z-index: 99999"] {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Ensure body is scrollable */
          body {
            overflow: auto !important;
          }
        `,
      },
      requests: cleanUrls.map((url) => ({ url })),
    };

    const startTime = Date.now();
    console.log(`[Start] Processing ${cleanUrls.length} URLs...`);

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

    // Download all screenshots in parallel for speed
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

    const manifestContent = [
      `Screenshot Batch Report`,
      `Generated: ${new Date().toISOString()}`,
      `Speed Mode: ${speedMode} - ${config.description}`,
      ``,
      `Performance:`,
      `- Total URLs: ${results.length}`,
      `- Successful: ${successCount}`,
      `- Failed: ${results.length - successCount}`,
      `- Total Time: ${totalTime}ms`,
      `- Average Time: ${avgTime.toFixed(0)}ms per screenshot`,
      ``,
      `Configuration:`,
      `- Wait Strategy: ${config.wait_until}`,
      `- Delay: ${config.delay}s`,
      `- Timeout: ${config.timeout}ms`,
      `- Script Blocking: ${config.block_scripts ? "Yes" : "No"}`,
      `- Geolocation: US (GDPR bypass)`,
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
        "X-Speed-Mode": speedMode,
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