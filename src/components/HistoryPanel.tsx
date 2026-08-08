import type { RaceResult } from '../types';

function formatSeconds(ms: number) {
  return (ms / 1000).toFixed(2);
}

interface HistoryPanelProps {
  history: RaceResult[];
  personalBestMs: number | null;
  onClose: () => void;
  onClear: () => void;
}

export function HistoryPanel({ history, personalBestMs, onClose, onClear }: HistoryPanelProps) {
  return (
    <div className="fixed inset-0 bg-graphite-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 font-body">
      <div className="bg-graphite-900 border border-steel/15 w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl p-5 max-h-[80vh] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-chalk uppercase tracking-wide">
            Sprint History
          </h2>
          <button onClick={onClose} className="text-steel hover:text-chalk text-sm">
            Close
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-steel/70 text-sm py-8 text-center">
            No saved sprints yet — run a race and tap Save Result.
          </p>
        ) : (
          <ul className="flex-1 overflow-y-auto flex flex-col gap-2">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between bg-graphite-800 rounded-xl px-4 py-3"
              >
                <div>
                  <div className="font-display font-semibold tabular-nums text-lg text-chalk">
                    {formatSeconds(r.timeMs)}s
                    {personalBestMs !== null && r.timeMs === personalBestMs && (
                      <span className="ml-2 text-flag text-xs align-middle">🏆 PB</span>
                    )}
                  </div>
                  <div className="text-xs text-steel/70">
                    {new Date(r.date).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {history.length > 0 && (
          <button onClick={onClear} className="text-xs text-steel/60 hover:text-steel underline self-center">
            Clear history
          </button>
        )}
      </div>
    </div>
  );
}
