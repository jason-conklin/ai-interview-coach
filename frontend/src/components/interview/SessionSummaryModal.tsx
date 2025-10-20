import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { SessionDetail } from "../../api/types";
import { fetchHistory } from "../../api/interview";
import { formatDuration, formatScore, formatDateTime } from "../../utils/formatters";

type SessionSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  session: SessionDetail | null;
  answersCompleted: number;
  questionTarget: number;
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

  const aggregate = useMemo(() => {
    if (!scoredAnswers.length) {
      return {
        averageScore: null as number | null,
        totalDurationMs: answers.reduce((sum, answer) => sum + (answer.duration_ms ?? 0), 0),
      };
    }
    const totalDurationMs = answers.reduce((sum, answer) => sum + (answer.duration_ms ?? 0), 0);
    const averageScore =
      scoredAnswers.reduce((sum, answer) => sum + (answer.evaluation?.score ?? 0), 0) /
      scoredAnswers.length;
    return {
      averageScore,
      totalDurationMs,
    };
  }, [answers, scoredAnswers]);

  const groupedAnswers = useMemo(() => {
    const map = new Map<
      number,
      {
        questionText: string;
        attempts: typeof answers;
      }
    >();
    answers.forEach((answer) => {
      const questionId = answer.question.id;
      const entry = map.get(questionId);
      if (entry) {
        entry.attempts.push(answer);
      } else {
        map.set(questionId, {
          questionText: answer.question.text,
          attempts: [answer],
        });
      }
    });
    return Array.from(map.values());
  }, [answers]);

  const waysToImprove = useMemo(() => {
    return groupedAnswers
      .map((group) => {
        const latestAttempt = group.attempts[group.attempts.length - 1];
        const evaluation = latestAttempt.evaluation;
        if (!evaluation) {
          return null;
        }
        const lines =
          latestAttempt.answer_text
            ?.split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0) ?? [];
        const firstLine =
          lines.find((line) => !line.toLowerCase().startsWith("language:")) ?? lines[0] ?? "";
        if (!firstLine) {
          return null;
        }
        const snippet =
          firstLine.length > 140 ? `${firstLine.slice(0, 137).trimEnd()}...` : firstLine;
        const suggestion =
          evaluation.suggested_improvements?.[0] ??
          "Add more specific outcomes or metrics to strengthen the response.";
        return {
          question: group.questionText,
          snippet,
          suggestion,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 4);
  }, [groupedAnswers]);

  const { data: historySessions } = useQuery({
    queryKey: ["history-trend", session?.role.slug],
    queryFn: () => fetchHistory({ role: session?.role.slug, limit: 12 }),
    enabled: isOpen && Boolean(session?.role.slug),
  });

  const scoreTrend = useMemo(() => {
    const history = historySessions ?? [];
    const combined: Array<{ score: number; label: string; startedAt: string }> = [];
    history
      .filter((item) => item.overall_score !== null && item.overall_score !== undefined)
      .forEach((item) => {
        combined.push({
          score: item.overall_score ?? 0,
          label: formatDateTime(item.started_at),
          startedAt: item.started_at,
        });
      });
    if (session?.overall_score !== null && session?.overall_score !== undefined) {
      combined.push({
        score: session.overall_score ?? 0,
        label: formatDateTime(session.started_at),
        startedAt: session.started_at,
      });
    }
    const deduped = Array.from(
      new Map(combined.map((entry) => [entry.startedAt, entry])).values(),
    );
    return deduped.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  }, [historySessions, session?.overall_score, session?.started_at]);

  const chartPoints = useMemo(() => {
    if (!scoreTrend.length) {
      return [];
    }
    const width = 100;
    const height = 60;
    return scoreTrend.map((point, index) => {
      const x = scoreTrend.length === 1 ? width / 2 : (index / (scoreTrend.length - 1)) * width;
      const y = height - (Math.min(10, Math.max(0, point.score)) / 10) * height;
      return { ...point, x, y };
    });
  }, [scoreTrend]);

  const chartPolyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  const readyPercentage =
    questionTarget > 0 ? Math.min(100, Math.round((answersCompleted / questionTarget) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-40 flex min-h-0 items-center justify-center bg-slate-900/70 px-4 py-8 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95 sm:p-8">
        <button
          type="button"
          aria-label="Close summary"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-base text-slate-500 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-light dark:hover:text-brand-light"
        >
          ×
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
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ways to Improve</h3>
              {waysToImprove.length ? (
                <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  {waysToImprove.map((item) => (
                    <li key={item.question} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                      <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                        {item.question}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                        {item.suggestion}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        You wrote: “{item.snippet}”. Try reframing it to emphasize outcomes and clarity.
                      </p>
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
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Score trend</h3>
              {chartPoints.length ? (
                <div className="mt-3">
                  <svg viewBox="0 0 100 60" className="h-24 w-full text-brand dark:text-brand-light">
                    <line x1="0" y1="59" x2="100" y2="59" stroke="currentColor" strokeWidth="0.5" opacity={0.2} />
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      points={chartPolyline}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {chartPoints.map((point, index) => (
                      <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="1.5" fill="currentColor" />
                    ))}
                  </svg>
                  <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{chartPoints[0]?.label ?? ""}</span>
                    <span>{chartPoints[chartPoints.length - 1]?.label ?? ""}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Build a few practice sessions to unlock your score progression.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Answer breakdown</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {groupedAnswers.length ? (
                groupedAnswers.map((group, index) => {
                  const attempts = group.attempts;
                  const latestAttempt = attempts[attempts.length - 1];
                  const bestScore = Math.max(
                    ...attempts.map((attempt) => attempt.evaluation?.score ?? 0),
                  );
                  return (
                    <div key={`${group.questionText}-${index}`} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs uppercase text-slate-400">Question {index + 1}</span>
                      <span className="text-xs font-semibold text-brand dark:text-brand-light">
                        Best {formatScore(bestScore, 1)} / 10
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {group.questionText}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Attempts: {attempts.length} &middot; Last attempt score:{" "}
                      {formatScore(latestAttempt.evaluation?.score ?? null, 1)}
                    </p>
                    {latestAttempt.evaluation?.feedback_markdown ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {latestAttempt.evaluation.feedback_markdown.replace(/\*\*/g, "")}
                      </p>
                    ) : null}
                  </div>
                  );
                })
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
