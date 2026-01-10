export interface ScreenshotRequest {
  url: string;
}

export interface ScreenshotResponse {
  screenshotUrl: string;
}

export interface ScreenshotError {
  error: string;
}

export type ScreenshotResult = 
  | { success: true; screenshotUrl: string }
  | { success: false; error: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Generate a screenshot for a single URL using the Supabase Edge Function
 */
export async function generateScreenshot(url: string): Promise<ScreenshotResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { 
      success: false, 
      error: "Supabase is not configured. Please connect Supabase to enable screenshots." 
    };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/screenshot`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ url } as ScreenshotRequest),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        error: (data as ScreenshotError).error || "Failed to generate screenshot" 
      };
    }

    return { 
      success: true, 
      screenshotUrl: (data as ScreenshotResponse).screenshotUrl 
    };
  } catch (error) {
    console.error("Screenshot API error:", error);
    return { 
      success: false, 
      error: "Network error. Please try again." 
    };
  }
}

/**
 * Generate screenshots for multiple URLs in parallel
 */
export async function generateScreenshotsBatch(
  urls: string[],
  onProgress?: (completed: number, total: number, url: string, result: ScreenshotResult) => void
): Promise<Map<string, ScreenshotResult>> {
  const results = new Map<string, ScreenshotResult>();
  
  // Process all URLs in parallel
  const promises = urls.map(async (url) => {
    const result = await generateScreenshot(url);
    results.set(url, result);
    onProgress?.(results.size, urls.length, url, result);
    return { url, result };
  });

  await Promise.all(promises);
  return results;
}
