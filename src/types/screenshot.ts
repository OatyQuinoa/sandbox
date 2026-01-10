export interface Screenshot {
  id: string;
  url: string;
  thumbnailUrl: string;
  fullImageUrl: string;
  createdAt: Date;
  status: "processing" | "completed" | "error";
  fileSize?: string;
  resolution?: string;
  generationTime?: number;
  errorMessage?: string;
}

export interface ScreenshotRequest {
  url: string;
}

export interface ScreenshotApiResponse {
  screenshotUrl: string;
}

export interface ScreenshotApiError {
  error: string;
}
