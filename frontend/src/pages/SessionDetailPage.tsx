import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { fetchSessionDetail } from "../api/interview";
import type { Answer } from "../api/types";
import { SessionStats } from "../components/interview/SessionStats";
import { QuestionCategoryBadge } from "../components/interview/QuestionCategoryBadge";
import { formatDateTime, formatDuration, formatScore, readinessBadgeColor } from "../utils/formatters";

export const SessionDetailPage = () => {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const session = sessionQuery.data;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Session summary</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Role: {session?.role.name ?? "N/A"} | Start: {formatDateTime(session?.started_at)} | End:{" "}
            {formatDateTime(session?.ended_at)}
          </p>
        </div>
        <Link
          className="text-sm font-semibold text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-brand"
          to="/history"
        >
          {"<-"} Back to history
        </Link>
      </div>

      {session ? <SessionStats session={session} /> : null}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Responses & evaluations
        </h2>
        <div className="space-y-4">
          {session?.answers.length ? (
            session.answers.map((answer: Answer) => (
              <div
                key={answer.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <QuestionCategoryBadge category={answer.question.category} />
                  <span>
                    Duration {formatDuration(answer.duration_ms ?? 0)} | {formatDateTime(answer.started_at)}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                  {answer.question.text}
                </h3>
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {answer.answer_text}
                </div>
                {answer.evaluation ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-[minmax(0,220px)_1fr]">
                    <div className="flex flex-col gap-2 rounded-lg bg-brand/5 p-3 text-sm text-brand dark:bg-brand-light/10 dark:text-brand-light">
                      <span className="text-xs uppercase text-brand/70 dark:text-brand-light/70">Score</span>
                      <span className="text-2xl font-semibold text-brand dark:text-brand-light">
                        {formatScore(answer.evaluation.score, 1)} / 10
                      </span>
                      <span
                        className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${readinessBadgeColor(
                          answer.evaluation.readiness_tier,
                        )}`}
                      >
                        {answer.evaluation.readiness_tier} readiness
                      </span>
                    </div>
                    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-200">
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {answer.evaluation.feedback_markdown}
                        </ReactMarkdown>
                      </div>
                      {answer.evaluation.suggested_improvements.length ? (
                        <div>
                          <span className="text-xs uppercase text-slate-400 dark:text-slate-500">
                            Suggested improvements
                          </span>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {answer.evaluation.suggested_improvements.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    Answer awaiting evaluation. Submit again from the interview page.
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No answers recorded yet for this session.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
