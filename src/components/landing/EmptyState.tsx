import { motion } from "framer-motion";
import { ImageIcon } from "lucide-react";

export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      {/* Animated grid background */}
      <div className="relative mb-8">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 -m-10 dot-grid rounded-full opacity-30"
        />
        <div className="relative p-8 rounded-2xl bg-[hsl(var(--surface))] border border-border">
          <ImageIcon className="h-16 w-16 text-muted-foreground" />
        </div>
      </div>

      <h3 className="font-display text-2xl font-bold text-white mb-2">
        No screenshots yet
      </h3>
      <p className="font-mono text-sm text-muted-foreground max-w-sm">
        Paste URLs above and click generate to create your first screenshots
      </p>

      {/* Animated dots */}
      <div className="flex gap-1 mt-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
            className="w-2 h-2 rounded-full bg-cyan"
          />
        ))}
      </div>
    </motion.div>
  );
}
