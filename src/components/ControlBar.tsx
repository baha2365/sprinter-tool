import type { CameraStatus } from '../hooks/useCamera';
import type { DetectorStatus } from '../hooks/usePoseDetection';

interface ControlBarProps {
  cameraStatus: CameraStatus;
  cameraError: string | null;
  onRequestCamera: () => void;
  detectorStatus: DetectorStatus;
  volume: number;
  onVolumeChange: (value: number) => void;
  onTestSound: () => void;
  onStartRace: () => void;
}

export function ControlBar({
  cameraStatus,
  cameraError,
  onRequestCamera,
  detectorStatus,
  volume,
  onVolumeChange,
  onTestSound,
  onStartRace,
}: ControlBarProps) {
  const cameraReady = cameraStatus === 'granted';
  const detectorReady = detectorStatus === 'ready';
  const canStart = cameraReady && detectorReady;

  return (
    <div className="bg-graphite-900 border border-steel/15 rounded-2xl p-4 flex flex-col gap-4 font-body">
      <div className="flex items-center justify-between text-sm">
        <span className="text-steel">Camera</span>
        <span className={cameraReady ? 'text-signal font-medium' : 'text-steel/70'}>
          {cameraStatus === 'idle' && 'Not started'}
          {cameraStatus === 'requesting' && 'Requesting…'}
          {cameraStatus === 'granted' && 'Ready'}
          {cameraStatus === 'denied' && (cameraError ?? 'Permission denied')}
          {cameraStatus === 'error' && (cameraError ?? 'Unavailable')}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-steel">Body tracker</span>
        <span className={detectorReady ? 'text-signal font-medium' : 'text-steel/70'}>
          {detectorStatus === 'idle' && 'Not loaded'}
          {detectorStatus === 'loading' && 'Loading…'}
          {detectorStatus === 'ready' && 'Ready'}
          {detectorStatus === 'error' && 'Failed to load'}
        </span>
      </div>

      {!cameraReady && (
        <button
          onClick={onRequestCamera}
          className="w-full py-3 rounded-xl bg-graphite-800 hover:bg-graphite-700 border border-steel/20 font-semibold transition-colors text-chalk"
        >
          Enable Camera
        </button>
      )}

      <div className="flex items-center gap-3 text-sm">
        <span className="text-steel w-16 shrink-0">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 accent-track"
          aria-label="Starter command volume"
        />
        <button
          onClick={onTestSound}
          className="text-[11px] font-semibold uppercase tracking-wide bg-graphite-800 hover:bg-graphite-700 border border-steel/20 px-3 py-2 rounded-full whitespace-nowrap text-chalk transition-colors"
        >
          Test Sound
        </button>
      </div>

      <button
        onClick={onStartRace}
        disabled={!canStart}
        className="w-full py-4 rounded-2xl bg-track disabled:bg-graphite-800 disabled:text-steel/40 text-graphite-950 font-display font-semibold text-lg tracking-wide uppercase transition-colors"
      >
        {canStart
          ? 'Start Race'
          : !cameraReady
            ? 'Enable camera to continue'
            : 'Loading body tracker…'}
      </button>
    </div>
  );
}
