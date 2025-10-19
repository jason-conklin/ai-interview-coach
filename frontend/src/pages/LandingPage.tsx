import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createSession, fetchRoles } from "../api/interview";
import type { Role } from "../api/types";
import { RoleCard } from "../components/RoleCard";
import { useInterviewSession } from "../hooks/useInterviewSession";

export const LandingPage = () => {
  const navigate = useNavigate();
  const { startSession } = useInterviewSession();

  const { data: roles, isLoading, isError } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const { mutateAsync: createSessionMutation, isPending } = useMutation({
    mutationFn: (role: Role) => createSession({ role_slug: role.slug }),
  });

  const handleSelectRole = async (role: Role) => {
    const session = await createSessionMutation(role);
    startSession({
      id: session.id,
      roleSlug: role.slug,
      roleName: role.name,
      startedAt: session.started_at,
    });
    navigate(`/interview/${session.id}`, { replace: true });
  };

  return (
    <section className="space-y-10">
      <div className="rounded-3xl bg-gradient-to-r from-brand/10 via-white to-brand/10 p-10 shadow-card dark:from-brand-dark/20 dark:via-slate-900 dark:to-brand-dark/20">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Prepare with confidence. Practice structured interviews tailored to your next role.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Run realistic mock interviews, capture your responses, and receive AI-powered coaching
          anchored in clarity, correctness, and impact. Track your readiness over time and focus on what
          matters most before the real conversation.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Choose a role to begin
        </h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading roles...</p>
        ) : isError ? (
          <p className="mt-4 text-sm text-danger">
            Unable to load roles. Please ensure the API is running.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {roles?.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onSelect={(selectedRole) => handleSelectRole(selectedRole)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          What you&apos;ll practice
        </h3>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Behavioral storytelling using STAR so your impact lands clearly.</li>
          <li>Technical depth with follow-up prompts to stretch your reasoning.</li>
          <li>Role-specific scenarios grounded in tools, workflows, and tradeoffs.</li>
        </ul>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Looking for speech practice? Audio recording lands soon. For now, focus on crisp written
          responses and score your readiness tier.
        </p>
        <button
          disabled={isPending}
          onClick={() => {
            const firstRole = roles?.[0];
            if (firstRole) {
              handleSelectRole(firstRole);
            }
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/70"
        >
          {isPending ? "Starting session..." : "Quick start with first role"}
        </button>
      </div>
    </section>
  );
};
