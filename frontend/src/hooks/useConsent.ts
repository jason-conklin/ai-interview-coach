import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ai-coach-consent-v1";

export const useConsent = () => {
  const [hasConsented, setHasConsented] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "accepted";
  });

  const acceptConsent = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setHasConsented(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue === "accepted") {
        setHasConsented(true);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return {
    hasConsented,
    acceptConsent,
  };
};
