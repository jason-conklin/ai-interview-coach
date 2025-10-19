import type { RoleLevel } from "../api/types";

const QUESTION_TARGETS: Record<RoleLevel, number> = {
  internship: 3,
  entry: 4,
  mid: 5,
  senior: 6,
  staff: 7,
};

export const getQuestionTargetForLevel = (level: RoleLevel): number => QUESTION_TARGETS[level] ?? QUESTION_TARGETS.entry;

