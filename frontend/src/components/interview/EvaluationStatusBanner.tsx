import { useEffect, useState } from "react";

type Status = "llm" | "heuristic" | "unknown";

interface EvaluationStatusBannerProps {
  status: Status;
  visible: boolean;
  onDismiss: () => void;
}

export const EvaluationStatusBanner = ({ status, visible, onDismiss }: EvaluationStatusBannerProps) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (status !== "heuristic" || !visible) {
      setShouldAnimate(false);
      return undefined;
    }

    setShouldAnimate(false);
    const raf = typeof window.requestAnimationFrame === "function";
    const frame = raf ? window.requestAnimationFrame(() => setShouldAnimate(true)) : null;
    if (!raf) {
      setShouldAnimate(true);
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (frame !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [status, visible, onDismiss]);

  if (status !== "heuristic" || !visible) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`fixed top-0 left-0 right-0 z-50 border-b border-amber-300 bg-amber-100/95 text-amber-800 shadow-sm transition-opacity duration-300 ease-in-out ${
        shouldAnimate ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-4 px-4 py-2 text-sm font-medium">
        <span>⚠️ AI Evaluation Unavailable — Using Offline Heuristic Mode. Feedback may be limited.</span>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-amber-400 px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-200 focus:outline-none focus-visible:ring focus-visible:ring-amber-500/60"
          aria-label="Dismiss offline heuristic banner"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
