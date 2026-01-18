import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

/* ============================================================
   CORS
============================================================ */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ============================================================
   Types
============================================================ */
interface BulkScreenshotRequest {
  urls: string[];
  speed?: "fastest" | "fast" | "balanced" | "quality";
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

/* ============================================================
   Speed Configurations
============================================================ */
const SPEED_CONFIGS = {
  fastest: {
    wait_until: "load",
    delay: 0,
    block_scripts: true,
    timeout: 5000,
    description: "Screenshot in <1s, blocks all JavaScript including banners",
  },
  fast: {
    wait_until: "domcontentloaded",
    delay: 0.5,
    block_scripts: false,
    timeout: 8000,
    description: "Screenshot in 1-2s, allows essential scripts",
  },
  balanced: {
    wait_until: "networkidle2",
    delay: 1,
    block_scripts: false,
    timeout: 12000,
    description: "Screenshot in 2-3s, balanced approach (DEFAULT)",
  },
  quality: {
    wait_until: "networkidle0",
    delay: 3,
    block_scripts: false,
    timeout: 20000,
    description: "Screenshot in 4-6s, highest quality",
  },
};

/* ============================================================
   Banner Handling Scripts
============================================================ */
const FAST_BANNER_KILLER = `
(function() {
  const kill = () => {
    ['#onetrust-banner-sdk','#onetrust-consent-sdk','#onetrust-pc-sdk','.onetrust-pc-dark-filter']
      .forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));

    ['[id*="cookie"]','[id*="consent"]','[class*="cookie"]','[class*="consent"]']
      .forEach(s => document.querySelectorAll(s).forEach(e => {
        if(e.textContent?.toLowerCase().includes('accept')) e.remove();
      }));

    document.body.style.overflow = '';
  };

  kill();
  setTimeout(kill, 100);
  setTimeout(kill, 300);
})();
`;

const BLOCK_BANNER_SCRIPTS = `
(function() {
  const blockedDomains = ['cookielaw.org', 'onetrust', 'cookiebot', 'trustarc', 'didomi'];

  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0]?.toString() || '';
    if (blockedDomains.some(d => url.includes(d))) {
      return Promise.reject(new Error('Blocked'));
    }
    return originalFetch.apply(this, args);
  };

  const observer = new MutationObserver(mutations => {
    mutations.forEach(m =>
      m.addedNodes.forEach(node => {
        if (node.nodeName === 'SCRIPT' && node.src) {
          if (blockedDomains.some(d => node.src.includes(d))) node.remove();
        }
      })
    );
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
`;

/* ============================================================
   Utilities
============================================================ */
function isValidUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeFilename(url: string): string {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname + parsed.pathname)
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .slice(0, 100) || "screenshot"
    );
  } catch {
    return "screenshot";
  }
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    [
      "consent-modal",
      "consent",
      "cookie-consent",
      "gdpr",
      "privacy",
      "show-consent",
      "showConsent",
      "consent_modal",
      "cookie_consent",
    ].forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return url;
  }
}

/* ============================================================
   Server
============================================================ */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("SCREENSHOTONE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Screenshot service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: BulkScreenshotRequest = await req.json();
    if (!Array.isArray(body.urls) || body.urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "URLs array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.urls.length > 20) {
      return new Response(
        JSON.stringify({ error: "Maximum 20 URLs allowed per request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const invalidUrls = body.urls.filter((u) => !isValidUrl(u));
    if (invalidUrls.length) {
      return new Response(
        JSON.stringify({ error: `Invalid URLs: ${invalidUrls.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const speedMode = body.speed || "fast";
    const config = SPEED_CONFIGS[speedMode];
    const cleanUrls = body.urls.map(sanitizeUrl);

    console.log(`[Speed Mode] ${speedMode} - ${config.description}`);

    const bulkRequestBody = {
      access_key: apiKey,
      execute: true,
      optimize: true,
      options: {
        // Basic
        viewport_width: 1280,
        viewport_height: 800,
        format: "png",
        cache: false,
    
        // Blocking (let ScreenshotOne handle it)
        block_cookie_banners: true,
        block_banners_by_heuristics: true,
        block_ads: true,
        block_chats: true,
        
        // Wait strategy (crucial for banner blocking)
        wait_until: "networkidle2",
        delay: 2,
        timeout: 15000,
        
        // Bot detection prevention
        stealth_mode: true,
        reduce_motion: true,
        ignore_host_errors: true,
        ip_country_code: "us",  // Rotate IPs via ScreenshotOne proxies
        
        // Fail fast on CAPTCHAs (optional)
        fail_if_content_contains: "captcha",
      },
      requests: cleanUrls.map((url) => ({ url })),
    };

    const startTime = Date.now();
    const bulkResponse = await fetch("https://api.screenshotone.com/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bulkRequestBody),
    });

    if (!bulkResponse.ok) {
      const errorText = await bulkResponse.text();
      throw new Error(errorText);
    }

    const { responses = [] }: ScreenshotOneResponse = await bulkResponse.json();
    const zip = new JSZip();
    const results: any[] = [];

    await Promise.all(
      responses.map(async (item, i) => {
        const originalUrl = body.urls[i];
        const filename = `${sanitizeFilename(originalUrl)}_${i + 1}.png`;
        const start = Date.now();

        if (item.response?.is_successful) {
          const img = await fetch(item.url);
          if (img.ok) {
            zip.file(filename, await img.arrayBuffer());
            results.push({ url: originalUrl, filename, success: true, timing: Date.now() - start });
            return;
          }
        }

        results.push({
          url: originalUrl,
          filename,
          success: false,
          error: item.response?.body?.error_message || "Screenshot failed",
        });
      }),
    );

    const successCount = results.filter(r => r.success).length;
    const totalTime = Date.now() - startTime;

    zip.file("manifest.txt", `Generated: ${new Date().toISOString()}`);
    const zipBlob = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="screenshots_${Date.now()}.zip"`,
        "X-Processing-Time": `${totalTime}ms`,
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
