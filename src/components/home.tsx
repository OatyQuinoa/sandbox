import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { ScreenshotGrid } from "@/components/dashboard/ScreenshotGrid";
import { ProcessingQueue } from "@/components/dashboard/ProcessingQueue";
import { Lightbox } from "@/components/dashboard/Lightbox";
import { ToastNotification } from "@/components/ui/toast-notification";
import { useScreenshots } from "@/hooks/useScreenshots";
import { useUrlValidation } from "@/hooks/useUrlValidation";
import { Screenshot } from "@/types/screenshot";

function Home() {
  const [urls, setUrls] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] =
    useState<Screenshot | null>(null);

  const { isValid, validUrls } = useUrlValidation(urls);
  const {
    screenshots,
    processingQueue,
    isLoading,
    toasts,
    generateScreenshots,
    downloadScreenshot,
    deleteScreenshot,
    dismissToast,
  } = useScreenshots();

  const handleGenerate = useCallback(() => {
    if (validUrls.length > 0) {
      generateScreenshots(validUrls);
      setUrls("");
    }
  }, [validUrls, generateScreenshots]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to generate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (isValid && urls.trim() && !isLoading) {
          handleGenerate();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isValid, urls, isLoading, handleGenerate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* Main content */}
      <main className="pt-16 w-[1711px] h-[1070px]">
        {/* Hero / Input Section */}
        <HeroSection
          urls={urls}
          setUrls={setUrls}
          onGenerate={handleGenerate}
          isLoading={isLoading}
          isValid={isValid}
        />

        {/* Dashboard Section */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {/* Processing Queue */}
          <ProcessingQueue items={processingQueue} />

          {/* Screenshot Grid */}
          <ScreenshotGrid
            screenshots={screenshots}
            onDownload={downloadScreenshot}
            onDelete={deleteScreenshot}
            onPreview={setSelectedScreenshot}
          />
        </section>
      </main>
      {/* Lightbox */}
      {selectedScreenshot && (
        <Lightbox
          screenshot={selectedScreenshot}
          onClose={() => setSelectedScreenshot(null)}
          onDownload={downloadScreenshot}
        />
      )}
      {/* Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default Home;
