import { Link, NavLink, useNavigate } from "react-router-dom";

import { useInterviewSession } from "../../hooks/useInterviewSession";
import { ThemeToggle } from "./ThemeToggle";

const navLinkStyles =
  "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

export const Header = () => {
  const { activeSession, clearSession } = useInterviewSession();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand text-white">AI</span>
          Interview Coach
        </Link>

        <nav className="flex items-center gap-3">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `${navLinkStyles} ${isActive ? "bg-brand text-white dark:bg-brand-light" : ""}`
            }
          >
            Roles
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `${navLinkStyles} ${isActive ? "bg-brand text-white dark:bg-brand-light" : ""}`
            }
          >
            History
          </NavLink>
          {activeSession ? (
            <button
              type="button"
              className="rounded-lg border border-brand bg-transparent px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand hover:text-white dark:border-brand-light dark:text-brand-light dark:hover:bg-brand-light dark:hover:text-slate-900"
              onClick={() => navigate(`/sessions/${activeSession.id}`)}
            >
              Session Summary
            </button>
          ) : null}
          <ThemeToggle />
          {activeSession ? (
            <button
              type="button"
              onClick={() => {
                clearSession();
              }}
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:text-danger dark:text-slate-400 dark:hover:text-danger"
            >
              Clear Session
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
};
