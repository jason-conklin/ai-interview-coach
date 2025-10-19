import { format, formatDistanceStrict, parseISO } from "date-fns";

export const formatDateTime = (value: string | null | undefined, fallback = "N/A") => {
  if (!value) return fallback;
  try {
    return format(parseISO(value), "MMM d, yyyy h:mm a");
  } catch (error) {
    return fallback;
  }
};

export const formatDuration = (durationMs: number | null | undefined): string => {
  if (!durationMs || durationMs <= 0) return "0s";
  const minutes = Math.floor(durationMs / 1000 / 60);
  const seconds = Math.floor((durationMs / 1000) % 60);
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

export const formatElapsed = (start: string, end: string | null): string => {
  if (!start || !end) return "N/A";
  try {
    return formatDistanceStrict(parseISO(start), parseISO(end));
  } catch (error) {
    return "N/A";
  }
};

export const readinessBadgeColor = (tier?: string | null) => {
  switch (tier) {
    case "Ready":
      return "bg-success/10 text-success border-success/40";
    case "Emerging":
      return "bg-warning/10 text-warning border-warning/40";
    case "Exploring":
      return "bg-danger/10 text-danger border-danger/40";
    default:
      return "bg-slate-200 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
  }
};

export const formatScore = (score?: number | null, decimals = 1) => {
  if (score === undefined || score === null) {
    return "—";
  }
  return score.toFixed(decimals);
};
