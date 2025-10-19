import type { QuestionCategory } from "../../api/types";

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  role_specific: "Role Specific",
};

export const QuestionCategoryBadge = ({ category }: { category: QuestionCategory }) => {
  const baseStyles =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide";
  const styles: Record<QuestionCategory, string> = {
    behavioral: "border-brand/40 bg-brand/10 text-brand",
    technical: "border-warning/40 bg-warning/10 text-warning",
    role_specific: "border-success/40 bg-success/10 text-success",
  };
  return <span className={`${baseStyles} ${styles[category]}`}>{CATEGORY_LABELS[category]}</span>;
};
