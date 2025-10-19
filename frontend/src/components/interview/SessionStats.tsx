import { useMemo } from "react";

import type { SessionDetail } from "../../api/types";
import { formatDuration, formatScore, readinessBadgeColor } from "../../utils/formatters";

type SessionStatsProps = {
  session: SessionDetail | null;
};

export const SessionStats = ({ session }: SessionStatsProps) => {
  const totals = useMemo(() => {
    if (!session) {
      return {
        answers: 0,
        averageScore: null as number | null,
        totalDurationMs: 0,
      };
    }

    const answers = session.answers ?? [];
    const scoredAnswers = answers.filter((answer) => !!answer.evaluation);
    const averageScore =
      scoredAnswers.length > 0
        ? scoredAnswers.reduce((sum, answer) => sum + (answer.evaluation?.score ?? 0), 0) /
          scoredAnswers.length
        : null;
    const totalDurationMs = answers.reduce((sum, answer) => sum + (answer.duration_ms ?? 0), 0);

    return {
      answers: answers.length,
      averageScore,
      totalDurationMs,
    };
  }, [session]);

  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
      <div>
        <span className="text-xs uppercase text-slate-400">Overall tier</span>
        <div
          className={`mt-1 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${readinessBadgeColor(
            session?.summary_tier,
          )}`}
        >
          {session?.summary_tier ?? "Pending"}
        </div>
      </div>
      <div>
        <span className="text-xs uppercase text-slate-400">Average score</span>
        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
          {formatScore(totals.averageScore, 1)}
        </p>
      </div>
      <div>
        <span className="text-xs uppercase text-slate-400">Answers completed</span>
        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
          {totals.answers} &bull; {formatDuration(totals.totalDurationMs)}
        </p>
      </div>
    </div>
  );
};
