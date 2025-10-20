import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { SessionDetail } from "../../api/types";
import { fetchHistory } from "../../api/interview";
import { formatDuration, formatScore, formatDateTime } from "../../utils/formatters";

type RubricDescriptors = {
  label: string;
  improvement: string;
  strength: string;
};

const RUBRIC_DESCRIPTORS: Record<string, RubricDescriptors> = {
  clarity: {
    label: "Message clarity",
    improvement: "Clarify the problem, your role, and the outcome in one concise opener.",
    strength: "Your explanation is easy to follow and sets context quickly.",
  },
  structure: {
    label: "Story structure",
    improvement:
      "Walk through the Situation, the Task you owned, the Actions you took, and the measurable Results.",
    strength: "Strong narrative arc that makes it clear what you did and why it mattered.",
  },
  relevance: {
    label: "Relevance to question",
    improvement: "Tie your example back to the prompt and highlight why it matters for this role.",
    strength: "Example maps clearly to the prompt and role expectations.",
  },
  specificity: {
    label: "Specific detail",
    improvement: "Add concrete steps, dates, or stakeholders so the interviewer can visualize the work.",
    strength: "Excellent concrete details that show exactly what happened.",
  },
  use_of_metrics: {
    label: "Use of metrics",
    improvement: "Mention impact metrics (percentage, revenue, time saved) to show measurable value.",
    strength: "Great use of metrics to demonstrate impact.",
  },
  metrics: {
    label: "Use of metrics",
    improvement: "Mention impact metrics (percentage, revenue, time saved) to show measurable value.",
    strength: "Great use of metrics to demonstrate impact.",
  },
  star_completeness: {
    label: "STAR coverage",
    improvement: "Round out the story by explicitly naming the situation, your task, the action, and the results.",
    strength: "Complete STAR story that covers context, actions, and results.",
  },
  reflection: {
    label: "Reflection",
    improvement: "Close with lessons learned or what you would adjust next time.",
    strength: "Thoughtful reflection that shows self-awareness.",
  },
  correctness: {
    label: "Technical correctness",
    improvement: "Double-check logic and edge cases to ensure the solution handles the core scenario.",
    strength: "Solution handles the core logic accurately.",
  },
  tradeoffs: {
    label: "Trade-off discussion",
    improvement: "Mention the trade-offs you considered and why the chosen approach won.",
    strength: "Thoughtful trade-off discussion that demonstrates engineering judgment.",
  },
  complexity: {
    label: "Complexity awareness",
    improvement: "Call out the time and space complexity and how it scales.",
    strength: "Clear complexity analysis that shows awareness of scalability.",
  },
  tools_processes: {
    label: "Tooling & process fit",
    improvement: "Explain why the tooling or process you chose fits the role's environment.",
    strength: "Great alignment between tools/processes and the role's expectations.",
  },
  best_practices: {
    label: "Best practices",
    improvement: "Reference the standards or best practices you followed (testing, reviews, reliability).",
    strength: "Excellent references to best practices that build confidence.",
  },
  practical_depth: {
    label: "Practical depth",
    improvement: "Dive deeper into implementation details or operational considerations.",
    strength: "Rich practical detail that shows hands-on mastery.",
  },
  readability: {
    label: "Code readability",
    improvement: "Add clear naming, comments, or formatting to make the code easy to follow.",
    strength: "Readable code with thoughtful naming and structure.",
  },
  tests: {
    label: "Testing strategy",
    improvement: "Outline how you would validate the solution with tests or assertions.",
    strength: "Testing strategy covers key happy path and edge cases.",
  },
};

const describeImprovement = (key: string, score: number): string => {
  const descriptor = RUBRIC_DESCRIPTORS[key] ?? {
    label: key.replace(/_/g, " "),
    improvement: "Strengthen this dimension with more concrete detail and examples.",
    strength: "Well executed.",
  };
  return `${descriptor.label} (${score.toFixed(1)}/10): ${descriptor.improvement}`;
};

const describeStrength = (key: string, score: number): string => {
  const descriptor = RUBRIC_DESCRIPTORS[key] ?? {
    label: key.replace(/_/g, " "),
    improvement: "",
    strength: "Nicely done.",
  };
  return `${descriptor.label} (${score.toFixed(1)}/10): ${descriptor.strength}`;
};

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
  const [expandedQuestions, setExpandedQuestions] = useState<Record<number, boolean>>({});

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
      .map((group, index) => {
        const latestAttempt = group.attempts[group.attempts.length - 1];
        const evaluation = latestAttempt.evaluation;
        if (!evaluation || !evaluation.rubric) {
          return null;
        }
        const rubricEntries = Object.entries(evaluation.rubric).filter(([, value]) =>
          typeof value === "number" && !Number.isNaN(Number(value)),
        ) as Array<[string, number]>;
        if (!rubricEntries.length) {
          return null;
        }
        const sortedByScore = [...rubricEntries].sort((a, b) => a[1] - b[1]);
        const [lowestKey, lowestScore] = sortedByScore[0];
        const numericLowest = Number(lowestScore);
        const improvement =
          numericLowest >= 8.5
            ? "Scores are consistently strong across the rubric - consider practicing brand new scenarios for variety."
            : describeImprovement(lowestKey, numericLowest);
        const strengthEntry = sortedByScore
          .slice()
          .reverse()
          .find(([, score]) => Number(score) >= 7.5);
        const strength = strengthEntry
          ? describeStrength(strengthEntry[0], Number(strengthEntry[1]))
          : null;
        const questionId = group.attempts[0]?.question.id ?? index;
        return {
          questionId,
          question: group.questionText,
          improvement,
          strength,
          attempts: group.attempts.length,
          lastScore: evaluation.score,
          questionIndex: index,
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

  const toggleResponses = (questionId: number) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const sanitizeAnswerText = (text: string | null | undefined): string => {
    if (!text) return "";
    const lines = text.split(/\r?\n/);
    if (lines[0]?.toLowerCase().startsWith("language:")) {
      return lines.slice(1).join("\n").trim();
    }
    return text.trim();
  };

  return (
    <div className="fixed inset-0 z-40 flex min-h-0 items-center justify-center bg-slate-900/70 px-4 py-8 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95 sm:p-8">
        <button
          type="button"
          aria-label="Close summary"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-base text-slate-500 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-light dark:hover:text-brand-light"
        >
          <span aria-hidden="true">&times;</span>
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
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Answer breakdown</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {groupedAnswers.length ? (
                groupedAnswers.map((group, index) => {
                  const attempts = group.attempts;
                  const latestAttempt = attempts[attempts.length - 1];
                  const bestScore = Math.max(
                    ...attempts.map((attempt) => attempt.evaluation?.score ?? 0),
                  );
                  const questionId = attempts[0]?.question.id ?? index;
                  const isExpanded = expandedQuestions[questionId] ?? false;
                  return (
                    <div
                      key={`${group.questionText}-${index}`}
                      className="rounded-xl border border-slate-100 p-3 dark:border-slate-700"
                    >
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
                        Attempts: {attempts.length} &middot; Last attempt score: {formatScore(
                          latestAttempt.evaluation?.score ?? null,
                          1,
                        )}
                      </p>
                      {latestAttempt.evaluation?.feedback_markdown ? (
                        <p className="mt-2 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">
                          {latestAttempt.evaluation.feedback_markdown.replace(/\*\*/g, "")}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleResponses(questionId)}
                        className="mt-3 inline-flex items-center rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-light dark:hover:text-brand-light"
                      >
                        {isExpanded ? "Hide responses" : "View responses"}
                      </button>
                      {isExpanded ? (
                        <div className="mt-3 space-y-3 text-xs text-slate-600 dark:text-slate-300">
                          {attempts.map((attempt, attemptIndex) => (
                            <div key={`${attempt.id}-${attemptIndex}`} className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                <span>Attempt {attemptIndex + 1}</span>
                                <span>{formatDateTime(attempt.started_at)}</span>
                                <span>Score {formatScore(attempt.evaluation?.score ?? null, 1)}</span>
                              </div>
                              <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{sanitizeAnswerText(attempt.answer_text)}</pre>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p>No answers recorded yet. Submit responses to see detailed feedback.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ways to Improve</h3>
              {waysToImprove.length ? (
                <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  {waysToImprove.map((item) => (
                    <li key={item.questionId ?? item.questionIndex} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700" title={item.question}>
                      <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                        Question {item.questionIndex + 1}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                        {item.improvement}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Attempts: {item.attempts} &middot; Latest score: {formatScore(item.lastScore ?? null, 1)}
                      </p>
                      {item.strength ? (
                        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                          Strength: {item.strength}
                        </p>
                      ) : null}
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
