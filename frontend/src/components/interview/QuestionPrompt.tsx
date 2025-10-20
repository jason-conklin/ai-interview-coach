import type { Question } from "../../api/types";
import { getRoleLevelLabel } from "../../utils/levels";
import { QuestionCategoryBadge } from "./QuestionCategoryBadge";

type QuestionPromptProps = {
  question: Question;
};

export const QuestionPrompt = ({ question }: QuestionPromptProps) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
      <QuestionCategoryBadge category={question.category} />
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
        Difficulty {question.difficulty}/5
      </span>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
        Level {getRoleLevelLabel(question.level)}
      </span>
      {question.requires_code ? (
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand dark:bg-brand-light/20 dark:text-brand-light">
          Coding exercise
        </span>
      ) : null}
      {question.expected_duration_sec ? (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
          {Math.round(question.expected_duration_sec / 60)} min suggested
        </span>
      ) : null}
    </div>
    <p className="mt-4 whitespace-pre-line text-xl font-semibold leading-relaxed text-slate-900 dark:text-white">
      {question.text}
    </p>
    {question.keywords.length ? (
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
        {question.keywords.map((keyword) => (
          <span
            key={keyword}
            className="rounded-full bg-brand/10 px-3 py-1 text-brand dark:bg-brand-light/20 dark:text-brand-light"
          >
            {keyword}
          </span>
        ))}
      </div>
    ) : null}
  </div>
);
