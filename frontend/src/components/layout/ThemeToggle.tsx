import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

import { useTheme } from "../../hooks/useTheme";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-light dark:hover:text-brand-light"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <>
          <SunIcon className="size-4" />
          Light
        </>
      ) : (
        <>
          <MoonIcon className="size-4" />
          Dark
        </>
      )}
    </button>
  );
};
