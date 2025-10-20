import type { FormEvent, KeyboardEvent } from "react";

type AnswerComposerProps = {
  answerText: string;
  setAnswerText: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
  requiresCode?: boolean;
  codeLanguage?: string;
  onChangeLanguage?: (value: string) => void;
  languageOptions?: string[];
  submitLabel?: string;
};

export const AnswerComposer = ({
  answerText,
  setAnswerText,
  onSubmit,
  isSubmitting,
  disabled = false,
  requiresCode = false,
  codeLanguage,
  onChangeLanguage,
  languageOptions,
  submitLabel = "Submit Answer",
}: AnswerComposerProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!answerText.trim() || disabled) {
      return;
    }
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;

      if (event.shiftKey) {
        const before = answerText.slice(0, start);
        const after = answerText.slice(end);
        if (before.endsWith("\t")) {
          const updated = before.slice(0, -1) + after;
          setAnswerText(updated);
          window.requestAnimationFrame(() => {
            const newPos = Math.max(0, start - 1);
            target.selectionStart = target.selectionEnd = newPos;
          });
        }
        return;
      }

      const updated = answerText.slice(0, start) + "\t" + answerText.slice(end);
      setAnswerText(updated);
      window.requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      });
    }
  };

  const characterCount = answerText.length;
  const textareaClass = [
    "h-52 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-inner transition focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    requiresCode ? "font-mono tracking-tight caret-brand" : "leading-relaxed",
  ].join(" ");
  const languages = languageOptions ?? [
    "Python",
    "TypeScript",
    "JavaScript",
    "Java",
    "Go",
    "C++",
    "C#",
    "Ruby",
    "Swift",
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between">
        <label htmlFor="answer" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {requiresCode ? "Your solution" : "Your response"}
        </label>
        <span className="text-xs text-slate-400">{characterCount} characters</span>
      </div>
      {requiresCode && onChangeLanguage ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor="language" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Language
          </label>
          <select
            id="language"
            value={codeLanguage ?? languages[0]}
            onChange={(event) => onChangeLanguage(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {languages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <textarea
        id="answer"
        className={textareaClass}
        placeholder={
          requiresCode
            ? "Write your code snippet here, include tests or usage notes if relevant..."
            : "Walk through your approach, decisions, and impact..."
        }
        value={answerText}
        onChange={(event) => setAnswerText(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSubmitting}
        required
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={disabled || isSubmitting || answerText.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/60"
        >
          {isSubmitting ? "Evaluating..." : submitLabel}
        </button>
        <p className="text-xs text-slate-400">
          {requiresCode
            ? "TIP: Include executable code and mention how you would validate it with tests."
            : "TIP: Aim for structured storytelling. Mention tools, tradeoffs, and measurable outcomes."}
        </p>
      </div>
    </form>
  );
};
