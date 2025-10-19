type TimerDisplayProps = {
  elapsedSeconds: number;
  isRunning: boolean;
  onReset: () => void;
};

const formatTime = (value: number) => value.toString().padStart(2, "0");

export const TimerDisplay = ({ elapsedSeconds, isRunning, onReset }: TimerDisplayProps) => {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      <div>
        <span className="text-xs uppercase text-slate-400 dark:text-slate-500">Response Timer</span>
        <div className="text-lg font-semibold text-slate-900 dark:text-white">
          {formatTime(minutes)}:{formatTime(seconds)}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className={isRunning ? "text-success" : "text-slate-400"}>
          {isRunning ? "Recording" : "Paused"}
        </span>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-500 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-light dark:hover:text-brand-light"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
