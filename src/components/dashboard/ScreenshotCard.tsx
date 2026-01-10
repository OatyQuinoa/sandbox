import { motion } from "framer-motion";
import { Download, ExternalLink, Clock, FileImage, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Screenshot } from "@/types/screenshot";

interface ScreenshotCardProps {
  screenshot: Screenshot;
  index: number;
  onDownload: (screenshot: Screenshot) => void;
  onDelete: (id: string) => void;
  onPreview: (screenshot: Screenshot) => void;
}

export function ScreenshotCard({
  screenshot,
  index,
  onDownload,
  onDelete,
  onPreview,
}: ScreenshotCardProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  };

  const isError = screenshot.status === "error";
  const isProcessing = screenshot.status === "processing";
  const hasImage = screenshot.thumbnailUrl && screenshot.thumbnailUrl.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={`group relative bg-[hsl(var(--surface))] border rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-xl hover:shadow-cyan/5 ${
        isError ? "border-destructive/50" : "border-border"
      }`}
    >
      {/* Thumbnail */}
      <div
        onClick={() => hasImage && onPreview(screenshot)}
        className={`relative aspect-video overflow-hidden ${hasImage ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasImage ? (
          <img
            src={screenshot.thumbnailUrl}
            alt={`Screenshot of ${screenshot.url}`}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-muted/30 flex items-center justify-center">
            <AlertCircle className="h-12 w-12 text-destructive/50" />
          </div>
        )}
        
        {/* Overlay on hover */}
        {hasImage && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <span className="text-white font-mono text-sm">Click to preview</span>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-full w-1/2 bg-cyan"
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              Processing...
            </span>
          </div>
        )}

        {/* Error overlay */}
        {isError && hasImage && (
          <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
            <span className="font-mono text-sm text-destructive">
              Failed to capture
            </span>
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-4">
        {/* URL */}
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="font-mono text-xs text-muted-foreground truncate">
            {truncateUrl(screenshot.url)}
          </span>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs font-mono text-[hsl(var(--text-meta))] mb-4">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(screenshot.createdAt)}
          </span>
          {screenshot.fileSize && (
            <span className="flex items-center gap-1">
              <FileImage className="h-3 w-3" />
              {screenshot.fileSize}
            </span>
          )}
          {screenshot.resolution && (
            <span>{screenshot.resolution}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onDownload(screenshot)}
            disabled={screenshot.status !== "completed"}
            size="sm"
            className="flex-1 bg-cyan text-black hover:bg-cyan/90 font-mono text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
          <Button
            onClick={() => onDelete(screenshot.id)}
            variant="outline"
            size="sm"
            className="border-border hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
