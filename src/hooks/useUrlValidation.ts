import { useMemo } from "react";

export function useUrlValidation(urls: string) {
  const urlList = useMemo(() => {
    return urls
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
  }, [urls]);

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const isValid = useMemo(() => {
    if (urlList.length === 0) return true;
    return urlList.every((url) => isValidUrl(url));
  }, [urlList]);

  const validUrls = useMemo(() => {
    return urlList.filter((url) => isValidUrl(url));
  }, [urlList]);

  return {
    urlList,
    isValid,
    validUrls,
    urlCount: urlList.length,
    validCount: validUrls.length,
  };
}
