import type { FormEvent } from "react";

type AnswerComposerProps = {
  answerText: string;
  setAnswerText: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
  requiresCode?: boolean;
};

export const AnswerComposer = ({
  answerText,
  setAnswerText,
  onSubmit,
  isSubmitting,
  disabled = false,
  requiresCode = false,
}: AnswerComposerProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!answerText.trim() || disabled) {
      return;
    }
    onSubmit();
  };

  const characterCount = answerText.length;
  const textareaClass = [
    "h-52 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-inner transition focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    requiresCode ? "font-mono tracking-tight caret-brand" : "leading-relaxed",
  ].join(" ");

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
        disabled={disabled || isSubmitting}
        required
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={disabled || isSubmitting || answerText.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/60"
        >
          {isSubmitting ? "Evaluating..." : "Submit Answer"}
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
