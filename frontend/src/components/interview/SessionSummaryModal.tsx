import type { SessionDetail } from "../../api/types";
import { formatDuration, formatScore } from "../../utils/formatters";

type SessionSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  session: SessionDetail | null;
  answersCompleted: number;
  questionTarget: number;
};

const emptySummary = {
  averageScore: null as number | null,
  totalDurationMs: 0,
  suggestions: [] as string[],
};

export const SessionSummaryModal = ({
  isOpen,
  onClose,
  session,
  answersCompleted,
  questionTarget,
}: SessionSummaryModalProps) => {
  if (!isOpen) {
    return null;
  }

  const answers = session?.answers ?? [];
  const scoredAnswers = answers.filter((answer) => !!answer.evaluation);
  const aggregate =
    scoredAnswers.length > 0
      ? {
          averageScore:
            scoredAnswers.reduce((sum, answer) => sum + (answer.evaluation?.score ?? 0), 0) /
            scoredAnswers.length,
          totalDurationMs: answers.reduce((sum, answer) => sum + (answer.duration_ms ?? 0), 0),
          suggestions: Array.from(
            new Set(
              scoredAnswers
                .map((answer) => answer.evaluation?.suggested_improvements ?? [])
                .flat()
                .filter(Boolean),
            ),
          ).slice(0, 5),
        }
      : emptySummary;

  const readyPercentage =
    questionTarget > 0 ? Math.min(100, Math.round((answersCompleted / questionTarget) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 px-4 py-8 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95">
        <button
          type="button"
          aria-label="Close summary"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-slate-300 p-1 text-slate-500 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-light dark:hover:text-brand-light"
        >
          ✕
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand dark:text-brand-light">
              Interview recap
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              You completed {answersCompleted} of {questionTarget} questions
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Review your strengths, improvement levers, and plan the next practice loop.
            </p>
          </div>
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-brand/30 bg-brand/5 text-xl font-semibold text-brand dark:border-brand-light/30 dark:bg-brand-light/15 dark:text-brand-light">
            {readyPercentage}%
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs uppercase text-slate-400">Average score</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatScore(aggregate.averageScore, 1)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs uppercase text-slate-400">Time invested</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatDuration(aggregate.totalDurationMs)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs uppercase text-slate-400">Readiness tier</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {session?.summary_tier ?? "Keep practicing"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Next focus areas</h3>
            {aggregate.suggestions.length ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {aggregate.suggestions.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand dark:bg-brand-light" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Complete a few more questions to unlock targeted coaching tips.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Answer breakdown</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {answers.length ? (
                answers.map((answer, index) => (
                  <div key={answer.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs uppercase text-slate-400">Question {index + 1}</span>
                      <span className="text-xs font-semibold text-brand dark:text-brand-light">
                        {formatScore(answer.evaluation?.score ?? null, 1)} / 10
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {answer.question.text}
                    </p>
                    {answer.evaluation?.feedback_markdown ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {answer.evaluation.feedback_markdown.replace(/\*\*/g, "")}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p>No answers recorded yet. Submit responses to see detailed feedback.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-light dark:hover:text-brand-light"
          >
            Continue practicing
          </button>
        </div>
      </div>
    </div>
  );
};
