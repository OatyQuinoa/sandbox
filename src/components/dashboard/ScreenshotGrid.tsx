import { motion } from "framer-motion";
import { ScreenshotCard } from "./ScreenshotCard";
import { EmptyState } from "@/components/landing/EmptyState";
import { Screenshot } from "@/types/screenshot";

interface ScreenshotGridProps {
  screenshots: Screenshot[];
  onDownload: (screenshot: Screenshot) => void;
  onDelete: (id: string) => void;
  onPreview: (screenshot: Screenshot) => void;
}

export function ScreenshotGrid({
  screenshots,
  onDownload,
  onDelete,
  onPreview,
}: ScreenshotGridProps) {
  if (screenshots.length === 0) {
    return <EmptyState />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="py-8"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-bold text-white">
          Your Screenshots
        </h2>
        <span className="font-mono text-sm text-muted-foreground">
          {screenshots.length} item{screenshots.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Masonry-style grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {screenshots.map((screenshot, index) => (
          <ScreenshotCard
            key={screenshot.id}
            screenshot={screenshot}
            index={index}
            onDownload={onDownload}
            onDelete={onDelete}
            onPreview={onPreview}
          />
        ))}
      </div>
    </motion.div>
  );
}
