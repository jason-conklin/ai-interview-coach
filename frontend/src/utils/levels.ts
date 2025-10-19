import type { RoleLevel } from "../api/types";

export const ROLE_LEVEL_LABELS: Record<RoleLevel, string> = {
  internship: "Internship",
  entry: "Entry Level",
  mid: "Mid Level",
  senior: "Senior Level",
  staff: "Staff / Principal",
};

export const getRoleLevelLabel = (level: RoleLevel | string | null | undefined): string => {
  if (!level) {
    return ROLE_LEVEL_LABELS.entry;
  }
  const normalized = level as RoleLevel;
  return ROLE_LEVEL_LABELS[normalized] ?? (typeof level === "string" ? level.replaceAll("-", " ") : String(level));
};

