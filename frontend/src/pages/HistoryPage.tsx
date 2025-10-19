import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { fetchHistory, fetchRoles } from "../api/interview";
import type { HistoryItem, Role } from "../api/types";
import { useInterviewSession } from "../hooks/useInterviewSession";
import { formatDateTime, formatDuration, formatScore, readinessBadgeColor } from "../utils/formatters";

export const HistoryPage = () => {
  const { clearSession } = useInterviewSession();
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["history", selectedRole],
    queryFn: () => fetchHistory(selectedRole ? { role: selectedRole } : undefined),
  });

  const roles = rolesQuery.data ?? [];
  const sessions = (historyQuery.data ?? []) as HistoryItem[];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Practice history</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review past sessions, see readiness trends, and drill into detailed feedback.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-danger hover:text-danger dark:border-slate-700 dark:text-slate-300 dark:hover:border-danger dark:hover:text-danger"
          onClick={() => {
            clearSession();
            window.localStorage.removeItem("ai-coach-active-session");
          }}
        >
          Clear local session state
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="role-filter" className="text-sm text-slate-600 dark:text-slate-300">
          Filter by role
        </label>
        <select
          id="role-filter"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          value={selectedRole ?? ""}
          onChange={(event) => setSelectedRole(event.target.value || null)}
        >
          <option value="">All roles</option>
          {roles.map((role: Role) => (
            <option key={role.id} value={role.slug}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {historyQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading history...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                  No sessions found yet. Start practicing to see your progress timeline.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatDateTime(session.started_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {session.role.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatScore(session.overall_score, 1)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${readinessBadgeColor(
                        session.summary_tier,
                      )}`}
                    >
                      {session.summary_tier ?? "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {session.ended_at
                      ? formatDuration(
                          new Date(session.ended_at).getTime() - new Date(session.started_at).getTime(),
                        )
                      : "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/sessions/${session.id}`}
                      className="text-sm font-semibold text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-brand"
                    >
                      View details {"->"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
