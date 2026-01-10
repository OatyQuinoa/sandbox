import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProcessingItem {
  id: string;
  url: string;
  progress: number;
}

interface ProcessingQueueProps {
  items: ProcessingItem[];
}

export function ProcessingQueue({ items }: ProcessingQueueProps) {
  if (items.length === 0) return null;

  const truncateUrl = (url: string, maxLength = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-[hsl(var(--surface))] border border-border rounded-xl p-4 mb-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="h-4 w-4 animate-spin text-cyan" />
        <span className="font-display font-semibold text-white">
          Processing {items.length} URL{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground truncate max-w-[80%]">
                {truncateUrl(item.url)}
              </span>
              <span className="font-mono text-xs text-cyan">
                {item.progress}%
              </span>
            </div>
            <Progress value={item.progress} className="h-1" />
          </motion.div>
        ))}
      </div>

      <div className="mt-4 text-xs font-mono text-[hsl(var(--text-meta))]">
        // estimated time: ~{items.length * 2}s
      </div>
    </motion.div>
  );
}
