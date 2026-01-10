import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

interface HeroSectionProps {
  urls: string;
  setUrls: (urls: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  isValid: boolean;
}

export function HeroSection({
  urls,
  setUrls,
  onGenerate,
  isLoading,
  isValid,
}: HeroSectionProps) {
  const [charCount, setCharCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setCharCount(urls.length);
  }, [urls]);

  const urlCount = urls.trim() ? urls.trim().split("\n").filter((u) => u.trim()).length : 0;

  return (
    <section className="relative min-h-[60vh] flex flex-col items-center justify-center px-4 py-20">
      {/* Background dot grid */}
      <div className="absolute inset-0 dot-grid opacity-30" />
      
      {/* Noise texture overlay */}
      <div className="absolute inset-0 noise-texture pointer-events-none" />

      <div className="relative z-10 w-full max-w-3xl mx-auto text-center">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-4 tracking-tight"
        >
          Turn URLs Into Screenshots{" "}
          <span className="text-cyan">Instantly</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="font-mono text-sm sm:text-base text-muted-foreground mb-10 max-w-xl mx-auto"
        >
          Paste URLs. Generate screenshots. Download instantly.
          <br />
          <span className="text-[hsl(var(--text-meta))]">
            // supports batch processing
          </span>
        </motion.p>

        {/* URL Input Area */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative"
        >
          <div
            className={`relative rounded-xl border transition-all duration-200 ${
              isFocused
                ? "border-cyan glow-cyan"
                : isValid && urls.trim()
                ? "border-[hsl(var(--lime))]"
                : "border-border"
            } bg-[hsl(var(--surface))]`}
          >
            <Textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Paste URLs here (one per line)&#10;https://example.com&#10;https://github.com&#10;https://vercel.com"
              className="min-h-[200px] bg-transparent border-0 focus-visible:ring-0 font-mono text-sm resize-none p-4 placeholder:text-[hsl(var(--text-meta))]"
            />

            {/* Character count & URL count */}
            <div className="absolute bottom-3 right-3 flex items-center gap-4 text-xs font-mono text-[hsl(var(--text-meta))]">
              {urlCount > 0 && (
                <span className="text-lime">
                  {urlCount} URL{urlCount > 1 ? "s" : ""}
                </span>
              )}
              <span>{charCount} chars</span>
            </div>
          </div>

          {/* Validation feedback */}
          {urls.trim() && !isValid && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-sm text-destructive font-mono"
            >
              // invalid URL format detected
            </motion.p>
          )}
        </motion.div>

        {/* Generate Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8"
        >
          <Button
            onClick={onGenerate}
            disabled={!isValid || !urls.trim() || isLoading}
            size="lg"
            className={`
              relative px-10 py-6 text-base font-semibold
              bg-cyan text-black
              hover:scale-[1.02] transition-all duration-150
              disabled:opacity-50 disabled:hover:scale-100
              ${isValid && urls.trim() ? "glow-cyan" : ""}
            `}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Screenshots
              </>
            )}
          </Button>
        </motion.div>

        {/* Keyboard shortcut hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-4 text-xs font-mono text-[hsl(var(--text-meta))]"
        >
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
            ⌘
          </kbd>{" "}
          +{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
            Enter
          </kbd>{" "}
          to generate
        </motion.p>
      </div>
    </section>
  );
}
