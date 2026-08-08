import type { RacePhase } from '../types';

function formatSeconds(ms: number) {
  return (ms / 1000).toFixed(2);
}

interface RaceHUDProps {
  phase: RacePhase;
  prepRemaining: number;
  elapsedMs: number;
}

export function RaceHUD({ phase, prepRemaining, elapsedMs }: RaceHUDProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4">
      {phase === 'preparing' && (
        <div className="text-center bg-graphite-950/60 rounded-2xl px-8 py-5 backdrop-blur-sm border border-steel/15">
          <div className="text-xs font-body uppercase tracking-[0.35em] text-steel mb-1">
            Get Ready
          </div>
          <div className="font-display text-7xl font-semibold tabular-nums text-chalk">
            {prepRemaining}
          </div>
        </div>
      )}

      {phase === 'onYourMarks' && (
        <div className="font-display text-4xl sm:text-5xl font-semibold tracking-wide bg-graphite-950/60 rounded-2xl px-8 py-5 backdrop-blur-sm border border-steel/15 text-chalk uppercase text-center">
          On Your Marks
        </div>
      )}

      {phase === 'set' && (
        <div className="font-display text-5xl sm:text-6xl font-semibold tracking-wide bg-graphite-950/60 rounded-2xl px-10 py-6 backdrop-blur-sm border border-flag/30 text-flag uppercase">
          Set
        </div>
      )}

      {(phase === 'running' || phase === 'finished') && (
        <div className="font-display text-7xl sm:text-8xl font-semibold tabular-nums bg-graphite-950/50 rounded-3xl px-8 py-6 backdrop-blur-sm text-track timer-glow">
          {formatSeconds(elapsedMs)}
        </div>
      )}
    </div>
  );
}
