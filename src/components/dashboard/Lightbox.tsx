import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ZoomIn, ZoomOut, ExternalLink, Clock, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Screenshot } from "@/types/screenshot";
import { useState } from "react";

interface LightboxProps {
  screenshot: Screenshot | null;
  onClose: () => void;
  onDownload: (screenshot: Screenshot) => void;
}

export function Lightbox({ screenshot, onClose, onDownload }: LightboxProps) {
  const [zoom, setZoom] = useState(1);

  if (!screenshot) return null;

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:bg-white/10"
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-6xl w-full max-h-[90vh] flex flex-col"
        >
          {/* Image container */}
          <div className="flex-1 overflow-auto rounded-xl bg-[hsl(var(--surface))] border border-border">
            <div className="relative min-h-[300px] flex items-center justify-center p-4">
              <motion.img
                src={screenshot.fullImageUrl}
                alt={`Full screenshot of ${screenshot.url}`}
                style={{ scale: zoom }}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
          </div>

          {/* Metadata bar */}
          <div className="mt-4 bg-[hsl(var(--surface))] border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* URL and metadata */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-cyan" />
                <span className="font-mono text-sm text-white truncate max-w-md">
                  {screenshot.url}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(screenshot.createdAt)}
                </span>
                {screenshot.resolution && (
                  <span>{screenshot.resolution}</span>
                )}
                {screenshot.fileSize && (
                  <span className="flex items-center gap-1">
                    <FileImage className="h-3 w-3" />
                    {screenshot.fileSize}
                  </span>
                )}
                {screenshot.generationTime && (
                  <span className="text-lime">
                    {screenshot.generationTime}ms
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="border-border"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="font-mono text-sm text-muted-foreground w-14 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="border-border"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => onDownload(screenshot)}
                size="sm"
                className="bg-cyan text-black hover:bg-cyan/90 font-mono ml-2"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
