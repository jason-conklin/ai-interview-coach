import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Evaluation } from "../../api/types";
import { formatScore, readinessBadgeColor } from "../../utils/formatters";

type FeedbackPanelProps = {
  evaluation: Evaluation | null;
};

export const FeedbackPanel = ({ evaluation }: FeedbackPanelProps) => {
  if (!evaluation) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Submit your answer to see AI-powered feedback, rubric scores, and next steps.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl font-semibold text-slate-900 dark:text-white">
          Score {formatScore(evaluation.score, 1)} / 10
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${readinessBadgeColor(
            evaluation.readiness_tier,
          )}`}
        >
          {evaluation.readiness_tier} readiness
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Would you be hired? This tier signals you are {evaluation.readiness_tier.toLowerCase()} in your prep journey.
        </span>
      </div>
      <div className="prose prose-sm max-w-none text-slate-600 dark:prose-invert dark:text-slate-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {evaluation.feedback_markdown}
        </ReactMarkdown>
      </div>
      {evaluation.suggested_improvements.length ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Next steps</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {evaluation.suggested_improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
