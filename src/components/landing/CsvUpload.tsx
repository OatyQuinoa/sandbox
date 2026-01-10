import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Download, Loader2, AlertCircle } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { parseCSVForUrls, generateBulkScreenshotsZip } from "@/lib/screenshot-api";

interface CsvUploadProps {
  onUrlsExtracted?: (urls: string[]) => void;
}

export function CsvUpload({ onUrlsExtracted }: CsvUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    try {
      const content = await selectedFile.text();
      const extractedUrls = parseCSVForUrls(content);

      if (extractedUrls.length === 0) {
        setError("No valid URLs found in the CSV file");
        setUrls([]);
        return;
      }

      if (extractedUrls.length > 20) {
        setError(`Found ${extractedUrls.length} URLs. Maximum 20 allowed per request.`);
        setUrls(extractedUrls.slice(0, 20));
      } else {
        setUrls(extractedUrls);
      }

      onUrlsExtracted?.(extractedUrls.slice(0, 20));
    } catch (err) {
      setError("Failed to read CSV file");
      console.error("CSV parse error:", err);
    }
  }, [onUrlsExtracted]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    setUrls([]);
    setError(null);
    setProgress("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerateZip = async () => {
    if (urls.length === 0) return;

    setIsProcessing(true);
    setProgress("Starting bulk screenshot generation...");
    setError(null);

    const result = await generateBulkScreenshotsZip(urls, setProgress);

    if (result.success && result.blob) {
      setProgress("Downloading ZIP file...");
      
      // Create download link
      const downloadUrl = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `screenshots_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
      setProgress("Download complete!");
      setTimeout(() => setProgress(""), 3000);
    } else {
      setError(result.error || "Failed to generate screenshots");
    }

    setIsProcessing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="mt-8"
    >
      <div className="border-t border-border pt-8">
        <h3 className="font-display text-lg font-semibold text-white mb-4 text-center">
          Or upload a CSV file
        </h3>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative rounded-xl border-2 border-dashed transition-all duration-200 p-8 text-center ${
            isDragOver
              ? "border-cyan bg-cyan/5"
              : file
              ? "border-[hsl(var(--lime))] bg-lime/5"
              : "border-border hover:border-muted-foreground"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <AnimatePresence mode="wait">
            {file ? (
              <motion.div
                key="file-info"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-6 w-6 text-lime" />
                  <span className="font-mono text-sm text-white">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    className="h-6 w-6 text-muted-foreground hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <span className="font-mono text-xs text-lime">
                  {urls.length} URL{urls.length !== 1 ? "s" : ""} found
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="upload-prompt"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <span className="font-mono text-sm text-muted-foreground">
                    Drag & drop your CSV file here
                  </span>
                  <br />
                  <span className="font-mono text-xs text-[hsl(var(--text-meta))]">
                    or click to browse
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 text-destructive font-mono text-sm"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}

        {/* URL preview */}
        {urls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4"
          >
            <div className="bg-[hsl(var(--surface))] border border-border rounded-lg p-4 max-h-40 overflow-y-auto">
              <p className="font-mono text-xs text-muted-foreground mb-2">
                URLs to process:
              </p>
              <ul className="space-y-1">
                {urls.map((url, index) => (
                  <li key={index} className="font-mono text-xs text-white truncate">
                    {index + 1}. {url}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {/* Progress indicator */}
        {progress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-center"
          >
            <span className="font-mono text-sm text-cyan">{progress}</span>
          </motion.div>
        )}

        {/* Generate button */}
        {urls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center"
          >
            <Button
              onClick={handleGenerateZip}
              disabled={isProcessing || urls.length === 0}
              size="lg"
              className={`
                relative px-8 py-5 text-base font-semibold
                bg-lime text-black
                hover:scale-[1.02] transition-all duration-150
                disabled:opacity-50 disabled:hover:scale-100
                ${urls.length > 0 && !isProcessing ? "glow-lime" : ""}
              `}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" />
                  Generate & Download ZIP
                </>
              )}
            </Button>
            <p className="mt-2 font-mono text-xs text-[hsl(var(--text-meta))]">
              // max 20 URLs per batch
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
