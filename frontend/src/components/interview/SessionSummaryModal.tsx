import { useMemo, useRef, useState } from "react";

import type { SessionDetail } from "../../api/types";
import { formatDuration, formatScore, formatDateTime, readinessBadgeColor } from "../../utils/formatters";

type RubricDescriptors = {
  label: string;
  improvement: string;
  strength: string;
};



type TrendPoint = {
  questionNumber: number;
  attemptNumber: number;
  score: number;
  endedAt: string;
};

const CHART_WIDTH = 140;
const CHART_HEIGHT = 80;
const CHART_PADDING_X = 10;
const CHART_PADDING_Y = 10;
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
  return `${descriptor.label}: ${descriptor.improvement}`;
};

const describeStrength = (key: string | null, requiresCode: boolean): string | null => {
  if (!key) {
    return null;
  }
  const descriptor = STRENGTH_DESCRIPTORS[key];
  if (descriptor) {
    return requiresCode && descriptor.coding ? descriptor.coding : descriptor.general;
  }
  const fallback = RUBRIC_DESCRIPTORS[key];
  if (!fallback) {
    return null;
  }
  return requiresCode
    ? `${fallback.label}: solution aligns with coding best practices.`
    : `${fallback.label}: ${fallback.strength}`;
};

const STRENGTH_DESCRIPTORS: Record<string, { general: string; coding?: string }> = {
  structure: {
    general: "Story structure is clear and easy to follow.",
    coding: "Solution structure keeps the logic easy to trace.",
  },
  clarity: {
    general: "Explanation is concise and easy to understand.",
    coding: "Explanation walks through the algorithm steps clearly.",
  },
  specificity: {
    general: "Provides concrete details that land well with interviewers.",
    coding: "Includes specific implementation details that show depth.",
  },
  correctness: {
    general: "Reasoning is accurate and grounded.",
    coding: "Logic handles the core scenario correctly.",
  },
  tradeoffs: {
    general: "Thoughtful discussion of trade-offs.",
    coding: "Calls out engineering trade-offs convincingly.",
  },
  complexity: {
    general: "Great awareness of complexity and scaling.",
    coding: "Covers time and space complexity for the solution.",
  },
  readability: {
    general: "Communication is polished.",
    coding: "Code readability is strong with clear naming and layout.",
  },
  tests: {
    general: "Testing strategy is solid.",
    coding: "Testing coverage is thoughtful and relevant.",
  },
};

const IMPROVEMENT_DESCRIPTORS: Record<string, string[]> = {
  clarity: ["Clarify the problem and your role earlier in the answer.", "Explain why the situation mattered for the business or team."],
  structure: ["Organize the story so the situation, action, and result are easy to follow.", "Add a brief setup before diving into actions."],
  specificity: ["Add concrete steps, dates, or stakeholders so we can visualize the work.", "Mention the tools or systems you touched to show depth."],
  use_of_metrics: ["Quantify the impact with percentages, revenue, or time saved.", "Share before/after comparisons to prove effectiveness."],
  metrics: ["Quantify the impact with percentages, revenue, or time saved.", "Share before/after comparisons to prove effectiveness."],
  star_completeness: ["State the Situation, the Actions you took, and the measurable Results.", "Close with what changed after your actions."],
  reflection: ["Explain what you learned or would adjust next time.", "Mention how this shaped later projects or decisions."],
  correctness: ["Double-check logic and edge cases to ensure the solution handles the core scenario.", "Call out the validation steps you ran to prove correctness."],
  tradeoffs: ["Discuss the trade-offs you considered and why you chose this approach.", "Mention alternatives you ruled out and why."],
  complexity: ["State the time and space complexity and how it scales.", "Mention the performance considerations you weighed."],
  tools_processes: ["Tie the tools or process back to the role's environment.", "Explain why this tooling fit the constraints."],
  best_practices: ["Reference the standards or best practices you followed.", "Highlight testing, reviews, or monitoring you put in place."],
  practical_depth: ["Dive deeper into implementation or operational considerations.", "Mention how you handled deployment, monitoring, or maintenance."],
  readability: ["Improve naming, comments, or formatting so the code is easy to follow.", "Group related logic into helpers to reduce noise."],
  tests: ["Show how you would validate the solution with unit or integration tests.", "Call out the edge cases your tests cover."],
};

const createImprovementDescriptor = (key: string | null, fallback: string): string => {
  if (!key) {
    return fallback;
  }
  const descriptor = RUBRIC_DESCRIPTORS[key];
  const options = IMPROVEMENT_DESCRIPTORS[key];
  if (!descriptor || !options || !options.length) {
    return fallback;
  }
  const choice = options[Math.floor(Math.random() * options.length)];
  return `${descriptor.label}: ${choice}`;
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
        requiresCode: boolean;
        category: string;
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
          requiresCode: Boolean(answer.question.requires_code),
          category: answer.question.category,
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
        const fallbackImprovement =
          numericLowest >= 8.5
            ? "Scores are consistently strong across the rubric - consider practicing brand new scenarios for variety."
            : describeImprovement(lowestKey, numericLowest);
        const actionableTip = evaluation.suggested_improvements?.find(
          (tip) => tip && tip.trim().length > 0,
        );
        const improvementBase =
          numericLowest >= 8.5
            ? fallbackImprovement
            : createImprovementDescriptor(lowestKey, fallbackImprovement);
        const improvement =
          actionableTip && !improvementBase.includes(actionableTip)
            ? `${improvementBase} Next step: ${actionableTip}`
            : improvementBase;
        const extraSuggestions = (evaluation.suggested_improvements ?? [])
          .filter((tip) => tip && tip.trim().length > 0 && tip !== actionableTip)
          .slice(0, 2);
        if (lowestKey) {
          const descriptor = RUBRIC_DESCRIPTORS[lowestKey];
          const descriptorOptions = IMPROVEMENT_DESCRIPTORS[lowestKey] ?? [];
          for (const option of descriptorOptions) {
            if (extraSuggestions.length >= 2) {
              break;
            }
            const labeledOption = descriptor ? `${descriptor.label}: ${option}` : option;
            if (!extraSuggestions.includes(labeledOption)) {
              extraSuggestions.push(labeledOption);
            }
          }
        }
        const strengthEntry = sortedByScore
          .slice()
          .reverse()
          .find(([, score]) => Number(score) >= 7.5);
        const strength = strengthEntry
          ? describeStrength(strengthEntry[0], group.requiresCode)
          : null;
        const questionId = group.attempts[0]?.question.id ?? index;
        return {
          questionId,
          question: group.questionText,
          improvement,
          extraSuggestions,
          strength,
          attempts: group.attempts.length,
          lastScore: evaluation.score,
          questionIndex: index,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      ;
  }, [groupedAnswers]);

  const waysToImproveLookup = useMemo(() => {
    const map = new Map<number, (typeof waysToImprove)[number]>();
    waysToImprove.forEach((entry) => {
      map.set(entry.questionId ?? entry.questionIndex, entry);
    });
    return map;
  }, [waysToImprove]);

  const answerTrend = useMemo(() => {
    if (!answers.length) {
      return [];
    }

    const getTimestamp = (value?: string | null) => {
      if (!value) {
        return Number.POSITIVE_INFINITY;
      }
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
    };

    const sortedAttempts = [...answers].sort((a, b) => {
      const aTime = getTimestamp(a.ended_at ?? a.started_at);
      const bTime = getTimestamp(b.ended_at ?? b.started_at);
      return aTime - bTime;
    });

    const questionOrder = new Map<number, number>();
    const attemptCountByQuestion = new Map<number, number>();
    let nextQuestionNumber = 1;

    const trendPoints: TrendPoint[] = [];

    sortedAttempts.forEach((attempt) => {
      if (!attempt.evaluation) {
        return;
      }

      const questionId = attempt.question.id;
      if (!questionOrder.has(questionId)) {
        questionOrder.set(questionId, nextQuestionNumber);
        nextQuestionNumber += 1;
      }

      const timestamp = attempt.ended_at ?? attempt.started_at;
      if (!timestamp) {
        return;
      }

      const attemptNumber = (attemptCountByQuestion.get(questionId) ?? 0) + 1;
      attemptCountByQuestion.set(questionId, attemptNumber);
      const questionNumber = questionOrder.get(questionId) ?? nextQuestionNumber - 1;

      trendPoints.push({
        questionNumber,
        attemptNumber,
        score: attempt.evaluation.score ?? 0,
        endedAt: timestamp,
      });
    });

    return trendPoints;
  }, [answers]);

  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; data: TrendPoint } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  const chartPoints = useMemo(() => {
    if (!answerTrend.length) {
      return [];
    }
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const innerWidth = width - CHART_PADDING_X * 2;
    const innerHeight = height - CHART_PADDING_Y * 2;
    return answerTrend.map((point, index) => {
      const x =
        answerTrend.length === 1
          ? width / 2
          : CHART_PADDING_X + (index / (answerTrend.length - 1)) * innerWidth;
      const clampedScore = Math.min(10, Math.max(0, point.score));
      const y = CHART_PADDING_Y + innerHeight - (clampedScore / 10) * innerHeight;
      return { x, y, label: `Q${point.questionNumber}`, data: point };
    });
  }, [answerTrend]);

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
          {(() => {
            const readinessTier = session?.summary_tier ?? "Keep practicing";
            const badgeColor = readinessBadgeColor(session?.summary_tier);
            return (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs uppercase text-slate-400">Readiness tier</p>
                <div
                  className={`mt-2 inline-flex items-center justify-center rounded-full border px-4 py-1 text-sm font-semibold ${badgeColor}`}
                >
                  {readinessTier}
                </div>
              </div>
            );
          })()}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs uppercase text-slate-400">Time invested</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatDuration(aggregate.totalDurationMs)}
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
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Score trend</h3>
              {chartPoints.length ? (
                <div className="relative mt-3" ref={chartContainerRef}>
                  <svg
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    className="h-44 w-full text-brand dark:text-brand-light"
                    onMouseLeave={() => setHoverPoint(null)}
                  >
                    <line
                      x1={CHART_PADDING_X}
                      y1={CHART_HEIGHT - CHART_PADDING_Y}
                      x2={CHART_WIDTH - CHART_PADDING_X}
                      y2={CHART_HEIGHT - CHART_PADDING_Y}
                      stroke="currentColor"
                      strokeWidth="0.75"
                      opacity={0.25}
                    />
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeOpacity="0.65"
                      points={chartPolyline}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {chartPoints.map((point, index) => (
                      <circle
                        key={`${point.label}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={2.2}
                        fill="currentColor"
                        fillOpacity="0.9"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="0.8"
                        onMouseEnter={(event) => {
                          const svg = event.currentTarget.ownerSVGElement;
                          const container = chartContainerRef.current;
                          if (!svg || !container) return;
                          const svgRect = svg.getBoundingClientRect();
                          const containerRect = container.getBoundingClientRect();
                          const scaleX = svgRect.width / CHART_WIDTH;
                          const scaleY = svgRect.height / CHART_HEIGHT;
                          const relativeX = point.x * scaleX + (svgRect.left - containerRect.left);
                          const relativeY = point.y * scaleY + (svgRect.top - containerRect.top);
                          setHoverPoint({
                            x: relativeX,
                            y: relativeY,
                            data: point.data,
                          });
                        }}
                        onMouseMove={(event) => {
                          const svg = event.currentTarget.ownerSVGElement;
                          const container = chartContainerRef.current;
                          if (!svg || !container) return;
                          const svgRect = svg.getBoundingClientRect();
                          const containerRect = container.getBoundingClientRect();
                          const scaleX = svgRect.width / CHART_WIDTH;
                          const scaleY = svgRect.height / CHART_HEIGHT;
                          const relativeX = point.x * scaleX + (svgRect.left - containerRect.left);
                          const relativeY = point.y * scaleY + (svgRect.top - containerRect.top);
                          setHoverPoint({
                            x: relativeX,
                            y: relativeY,
                            data: point.data,
                          });
                        }}
                        onMouseLeave={() => setHoverPoint(null)}
                      />
                    ))}
                  </svg>
                  {hoverPoint ? (() => {
                    const container = chartContainerRef.current;
                    const containerRect = container?.getBoundingClientRect();
                    const tooltipWidth = 180;
                    const tooltipHeight = 104;
                    const width = containerRect?.width ?? tooltipWidth;
                    const height = containerRect?.height ?? tooltipHeight;
                    const left = Math.min(Math.max(hoverPoint.x + 12, 0), Math.max(width - tooltipWidth, 0));
                    const top = Math.min(Math.max(hoverPoint.y - tooltipHeight / 2, 0), Math.max(height - tooltipHeight, 0));
                    return (
                      <div
                        className="pointer-events-none absolute rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95"
                        style={{ left, top }}
                      >
                        <p className="font-semibold text-slate-800 dark:text-slate-100">Question {hoverPoint.data.questionNumber}</p>
                        <p className="text-slate-500 dark:text-slate-300">Attempt {hoverPoint.data.attemptNumber}</p>
                        <p className="text-slate-500 dark:text-slate-300">Score {formatScore(hoverPoint.data.score, 1)}</p>
                        <p className="text-slate-400 dark:text-slate-400">{formatDateTime(hoverPoint.data.endedAt)}</p>
                      </div>
                    );
                  })() : null}
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
                      {item.strength ? (
                        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                          {item.strength}
                        </p>
                      ) : null}
                      {item.extraSuggestions.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
                          {item.extraSuggestions.map((tip, suggestionIndex) => (
                            <li key={`${item.questionId ?? item.questionIndex}-suggestion-${suggestionIndex}`}>
                              {tip}
                            </li>
                          ))}
                        </ul>
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
