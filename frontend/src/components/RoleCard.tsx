import type { Role } from "../api/types";

type RoleCardProps = {
  role: Role;
  onSelect: (role: Role) => void;
};

export const RoleCard = ({ role, onSelect }: RoleCardProps) => (
  <button
    type="button"
    onClick={() => onSelect(role)}
    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-brand hover:shadow-card focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-light dark:focus:ring-offset-slate-950"
  >
    <span className="text-sm uppercase tracking-wide text-brand">{role.name}</span>
    <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
      {role.name}
    </h3>
    <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-300">
      {role.description ?? "Practice tailored behavioral and technical questions for this role."}
    </p>
    <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand">
      Start session {"->"}
    </span>
  </button>
);
