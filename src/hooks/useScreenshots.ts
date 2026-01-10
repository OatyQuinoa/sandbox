import { useState, useCallback } from "react";
import { Screenshot } from "@/types/screenshot";
import { Toast } from "@/components/ui/toast-notification";
import { generateScreenshot } from "@/lib/screenshot-api";

interface ProcessingItem {
  id: string;
  url: string;
  progress: number;
  status: "pending" | "processing" | "completed" | "error";
}

export function useScreenshots() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [processingQueue, setProcessingQueue] = useState<ProcessingItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addToast = useCallback(
    (type: Toast["type"], message: string, onRetry?: () => void) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, message, onRetry }]);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const generateScreenshots = useCallback(
    async (urls: string[]) => {
      setIsLoading(true);

      // Create processing items for all URLs
      const processingItems: ProcessingItem[] = urls.map((url) => ({
        id: Math.random().toString(36).substring(2, 9),
        url,
        progress: 0,
        status: "pending" as const,
      }));

      // Set initial queue with all items at 0 progress
      setProcessingQueue(processingItems.map(item => ({ ...item, progress: 10, status: "processing" as const })));

      // Process all URLs in parallel
      const promises = processingItems.map(async (item) => {
        // Update progress to show we're starting
        setProcessingQueue((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, progress: 30, status: "processing" as const } : p))
        );

        const startTime = Date.now();
        const result = await generateScreenshot(item.url);
        const generationTime = Date.now() - startTime;

        // Update progress to nearly complete
        setProcessingQueue((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, progress: 90 } : p))
        );

        // Small delay for UI feedback
        await new Promise(resolve => setTimeout(resolve, 200));

        // Remove from queue
        setProcessingQueue((prev) => prev.filter((p) => p.id !== item.id));

        if (result.success) {
          // Add completed screenshot with real ScreenshotOne URL
          const newScreenshot: Screenshot = {
            id: item.id,
            url: item.url,
            thumbnailUrl: result.screenshotUrl,
            fullImageUrl: result.screenshotUrl,
            createdAt: new Date(),
            status: "completed",
            resolution: "1280x800",
            generationTime,
          };

          setScreenshots((prev) => [newScreenshot, ...prev]);
          addToast("success", `Screenshot captured: ${item.url.substring(0, 30)}...`);
        } else {
          // Add error screenshot entry
          const errorScreenshot: Screenshot = {
            id: item.id,
            url: item.url,
            thumbnailUrl: "",
            fullImageUrl: "",
            createdAt: new Date(),
            status: "error",
          };

          setScreenshots((prev) => [errorScreenshot, ...prev]);
          addToast("error", `Failed: ${result.error}`);
        }

        return { item, result };
      });

      await Promise.all(promises);
      setIsLoading(false);
    },
    [addToast]
  );

  const downloadScreenshot = useCallback((screenshot: Screenshot) => {
    // In a real app, this would trigger a file download
    // For demo, we'll just show a toast
    const link = document.createElement("a");
    link.href = screenshot.fullImageUrl;
    link.download = `screenshot-${screenshot.id}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addToast("success", "Download started");
  }, [addToast]);

  const deleteScreenshot = useCallback((id: string) => {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
    addToast("success", "Screenshot deleted");
  }, [addToast]);

  return {
    screenshots,
    processingQueue,
    isLoading,
    toasts,
    generateScreenshots,
    downloadScreenshot,
    deleteScreenshot,
    dismissToast,
  };
}
