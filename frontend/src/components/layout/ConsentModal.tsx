import { useEffect, useState } from "react";

import { useConsent } from "../../hooks/useConsent";

export const ConsentModal = () => {
  const { hasConsented, acceptConsent } = useConsent();
  const [open, setOpen] = useState(!hasConsented);

  useEffect(() => {
    if (hasConsented) {
      setOpen(false);
    }
  }, [hasConsented]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
      <div className="max-w-xl rounded-xl bg-white p-6 shadow-card dark:bg-slate-900 dark:text-slate-100">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Privacy & Consent
        </h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          This AI Interview Coach stores your session history locally on this device to deliver
          personalized practice feedback. You can optionally create an account in the future to sync
          progress across devices. Audio recordings (when enabled) remain local unless you choose to
          export them. Evaluation results come from an AI model and may occasionally be imperfect or
          incomplete.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Session details and transcripts are saved in your browser storage only.</li>
          <li>Provide an API key to connect to your preferred LLM; otherwise local heuristics apply.</li>
          <li>You can clear your history at any time from the History view.</li>
        </ul>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          onClick={() => {
            acceptConsent();
            setOpen(false);
          }}
        >
          I understand and agree
        </button>
      </div>
    </div>
  );
};
