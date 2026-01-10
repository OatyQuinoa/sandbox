import { motion } from "framer-motion";
import { Camera } from "lucide-react";

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan/10 border border-cyan/20">
              <Camera className="h-5 w-5 text-cyan" />
            </div>
            <span className="font-display font-bold text-lg text-white">
              ScreenShot
            </span>
            <span className="font-mono text-xs text-[hsl(var(--text-meta))] hidden sm:inline">
              v1.0
            </span>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--surface))] border border-border">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-lime" />
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
