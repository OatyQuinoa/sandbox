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

    // Construct ScreenshotOne API URL
    const params = new URLSearchParams({
      access_key: apiKey,
      url: body.url,
      viewport_width: "1280",
      viewport_height: "800",
      format: "png",
      cache: "true",
      cache_ttl: "86400", // Cache for 24 hours
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