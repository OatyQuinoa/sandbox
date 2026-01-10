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

export interface BulkScreenshotResult {
  success: boolean;
  blob?: Blob;
  error?: string;
}

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
      `${SUPABASE_URL}/functions/v1/supabase-functions-screenshot`,
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

/**
 * Parse CSV content and extract URLs
 */
export function parseCSVForUrls(csvContent: string): string[] {
  const lines = csvContent.split(/\r?\n/);
  const urls: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Split by comma and check each cell for URLs
    const cells = trimmedLine.split(",").map((cell) => cell.trim().replace(/^["']|["']$/g, ""));
    
    for (const cell of cells) {
      if (isValidUrl(cell)) {
        urls.push(cell);
      }
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Generate bulk screenshots and return as ZIP file
 */
export async function generateBulkScreenshotsZip(
  urls: string[],
  onProgress?: (status: string) => void
): Promise<BulkScreenshotResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      success: false,
      error: "Supabase is not configured. Please connect Supabase to enable screenshots.",
    };
  }

  if (urls.length === 0) {
    return { success: false, error: "No valid URLs provided" };
  }

  if (urls.length > 20) {
    return { success: false, error: "Maximum 20 URLs allowed per request" };
  }

  try {
    onProgress?.("Sending request to server...");

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/supabase-functions-bulk-screenshot`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ urls }),
      }
    );

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || "Failed to generate screenshots" };
      }
      return { success: false, error: `Server error: ${response.status}` };
    }

    onProgress?.("Processing ZIP file...");
    const blob = await response.blob();

    return { success: true, blob };
  } catch (error) {
    console.error("Bulk screenshot API error:", error);
    return { success: false, error: "Network error. Please try again." };
  }
}
