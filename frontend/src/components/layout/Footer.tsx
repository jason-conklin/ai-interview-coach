export const Footer = () => (
  <footer className="border-t border-slate-200 bg-white py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
    <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 md:flex-row md:items-center md:justify-between">
      <p>
        Educational practice tool. No guarantee of hiring decisions. Feedback may be imperfect. Always
        validate critical advice with trusted mentors.
      </p>
      <div className="flex gap-4">
        <a
          className="hover:text-brand dark:hover:text-brand-light"
          href="#privacy"
        >
          Privacy
        </a>
        <a
          className="hover:text-brand dark:hover:text-brand-light"
          href="mailto:support@aiinterviewcoach.local"
        >
          Contact
        </a>
      </div>
    </div>
  </footer>
);
