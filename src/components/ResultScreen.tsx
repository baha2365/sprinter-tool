function formatSeconds(ms: number) {
  return (ms / 1000).toFixed(2);
}

interface ResultScreenProps {
  timeMs: number;
  personalBestMs: number | null;
  saved: boolean;
  onSave: () => void;
  onRunAgain: () => void;
  onViewHistory: () => void;
}

export function ResultScreen({
  timeMs,
  personalBestMs,
  saved,
  onSave,
  onRunAgain,
  onViewHistory,
}: ResultScreenProps) {
  const wouldBePb = personalBestMs === null || timeMs < personalBestMs;

  return (
    <div className="bg-graphite-900 border border-steel/15 rounded-2xl p-6 flex flex-col items-center gap-4 text-center font-body">
      <div className="text-xs uppercase tracking-[0.35em] text-steel">Sprint Complete</div>
      <div className="font-display text-6xl font-semibold tabular-nums text-track timer-glow">
        {formatSeconds(timeMs)}
        <span className="text-2xl ml-1">s</span>
      </div>
      {wouldBePb && (
        <div className="text-flag font-semibold text-sm">🏆 New Personal Best</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-2">
        <button
          onClick={onRunAgain}
          className="py-3 rounded-xl bg-graphite-800 hover:bg-graphite-700 border border-steel/20 font-semibold text-chalk transition-colors"
        >
          Run Again
        </button>
        <button
          onClick={onSave}
          disabled={saved}
          className="py-3 rounded-xl bg-track disabled:bg-graphite-800 disabled:text-steel/40 text-graphite-950 font-semibold transition-colors"
        >
          {saved ? 'Saved ✓' : 'Save Result'}
        </button>
        <button
          onClick={onViewHistory}
          className="py-3 rounded-xl bg-graphite-800 hover:bg-graphite-700 border border-steel/20 font-semibold text-chalk transition-colors"
        >
          Race History
        </button>
      </div>

      {!saved && (
        <p className="text-xs text-steel/70 -mt-1">
          Save the result to add it to your history — false triggers can be discarded instead.
        </p>
      )}
    </div>
  );
}
