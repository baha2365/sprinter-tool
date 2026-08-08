import { useCallback, useEffect, useRef, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { useRaceAudio } from './hooks/useRaceAudio';
import { useSprintTimer } from './hooks/useSprintTimer';
import { usePoseDetection } from './hooks/usePoseDetection';
import { useHistory } from './hooks/useHistory';
import { CameraView } from './components/CameraView';
import { ControlBar } from './components/ControlBar';
import { RaceHUD } from './components/RaceHUD';
import { ResultScreen } from './components/ResultScreen';
import { HistoryPanel } from './components/HistoryPanel';
import type { RacePhase } from './types';

const PREP_SECONDS = 60;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const camera = useCamera();
  const audio = useRaceAudio();
  const timer = useSprintTimer();
  const history = useHistory();

  const [phase, setPhase] = useState<RacePhase>('idle');
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS);
  const [pendingResultMs, setPendingResultMs] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Bumped on every start/cancel so in-flight async command sequences can
  // recognize they've been superseded and stop themselves.
  const raceTokenRef = useRef(0);
  const prepStartRef = useRef<number | null>(null);
  const prepIntervalRef = useRef<number | null>(null);

  const handleCrossing = useCallback(() => {
    const elapsed = timer.stop();
    setPendingResultMs(elapsed);
    setSaved(false);
    setPhase('finished');
  }, [timer]);

  const pose = usePoseDetection({
    videoRef: camera.videoRef,
    onCrossing: handleCrossing,
    active: phase === 'running',
  });

  useEffect(() => {
    pose.load();
    // Load once on mount; `load` is stable and guards against reloading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPrepInterval = useCallback(() => {
    if (prepIntervalRef.current !== null) {
      window.clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }
  }, []);

  const runCommandSequence = useCallback(
    async (token: number) => {
      setPhase('onYourMarks');
      await audio.speak('On your marks');
      if (raceTokenRef.current !== token) return;
      await wait(1800);
      if (raceTokenRef.current !== token) return;

      setPhase('set');
      await audio.speak('Set');
      if (raceTokenRef.current !== token) return;
      // A real starter's hold is deliberately unpredictable so athletes
      // can't anticipate the gun — randomize within a realistic window.
      const holdMs = 1200 + Math.random() * 1600;
      await wait(holdMs);
      if (raceTokenRef.current !== token) return;

      audio.playGunshot();
      timer.start();
      setPhase('running');
    },
    [audio, timer]
  );

  const startRace = useCallback(async () => {
    // Called directly from the button's onClick, so this is still within
    // the original user-gesture call stack — safe to touch AudioContext.
    audio.ensureContext();

    raceTokenRef.current += 1;
    const token = raceTokenRef.current;

    setPendingResultMs(null);
    setSaved(false);
    timer.reset();

    if (camera.status !== 'granted') {
      await camera.start();
    }
    if (raceTokenRef.current !== token) return;

    setPhase('preparing');
    setPrepRemaining(PREP_SECONDS);
    prepStartRef.current = performance.now();

    clearPrepInterval();
    prepIntervalRef.current = window.setInterval(() => {
      if (prepStartRef.current === null) return;
      const elapsedSec = (performance.now() - prepStartRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(PREP_SECONDS - elapsedSec));
      setPrepRemaining(remaining);
      if (remaining <= 0) {
        clearPrepInterval();
        if (raceTokenRef.current === token) {
          void runCommandSequence(token);
        }
      }
    }, 200);
  }, [audio, camera, clearPrepInterval, runCommandSequence, timer]);

  const skipPreparation = useCallback(() => {
    clearPrepInterval();
    setPrepRemaining(0);
    void runCommandSequence(raceTokenRef.current);
  }, [clearPrepInterval, runCommandSequence]);

  const cancelRace = useCallback(() => {
    raceTokenRef.current += 1;
    clearPrepInterval();
    timer.reset();
    setPhase('idle');
  }, [clearPrepInterval, timer]);

  const runAgain = useCallback(() => {
    setPendingResultMs(null);
    setSaved(false);
    setPhase('idle');
  }, []);

  const saveResult = useCallback(() => {
    if (pendingResultMs === null) return;
    history.addResult(pendingResultMs);
    setSaved(true);
  }, [history, pendingResultMs]);

  useEffect(() => () => clearPrepInterval(), [clearPrepInterval]);

  const isMidSequence = phase === 'onYourMarks' || phase === 'set' || phase === 'running';

  return (
    <div className="min-h-screen w-full bg-graphite-950 text-chalk flex flex-col font-body">
      <header className="px-5 pt-6 pb-3 flex items-center justify-between max-w-3xl w-full mx-auto">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-wide uppercase">
            Sprint Timer
          </h1>
          <p className="text-xs text-steel/70">Camera-based finish line detection</p>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="text-[11px] font-semibold uppercase tracking-wide bg-graphite-900 hover:bg-graphite-800 border border-steel/20 transition-colors px-3 py-2 rounded-full"
        >
          History
        </button>
      </header>

      <main className="flex-1 px-4 pb-6 flex flex-col gap-4 max-w-3xl w-full mx-auto">
        <div className="relative w-full aspect-[4/3] sm:aspect-video">
          <CameraView
            videoRef={camera.videoRef}
            trackPoint={pose.debugPoint}
            cameraReady={camera.status === 'granted'}
          />
          <RaceHUD phase={phase} prepRemaining={prepRemaining} elapsedMs={timer.displayMs} />
        </div>

        {phase === 'idle' && (
          <ControlBar
            cameraStatus={camera.status}
            cameraError={camera.error}
            onRequestCamera={camera.start}
            detectorStatus={pose.status}
            volume={audio.volume}
            onVolumeChange={audio.setVolume}
            onTestSound={audio.testSound}
            onStartRace={startRace}
          />
        )}

        {phase === 'preparing' && (
          <div className="flex justify-center gap-6">
            <button
              onClick={skipPreparation}
              className="text-sm text-steel hover:text-chalk underline underline-offset-4"
            >
              Skip preparation
            </button>
            <button
              onClick={cancelRace}
              className="text-sm text-steel/60 hover:text-steel underline underline-offset-4"
            >
              Cancel
            </button>
          </div>
        )}

        {isMidSequence && (
          <button
            onClick={cancelRace}
            className="self-center text-sm text-steel/60 hover:text-steel underline underline-offset-4"
          >
            Cancel
          </button>
        )}

        {phase === 'finished' && pendingResultMs !== null && (
          <ResultScreen
            timeMs={pendingResultMs}
            personalBestMs={history.personalBestMs}
            saved={saved}
            onSave={saveResult}
            onRunAgain={runAgain}
            onViewHistory={() => setShowHistory(true)}
          />
        )}
      </main>

      {showHistory && (
        <HistoryPanel
          history={history.history}
          personalBestMs={history.personalBestMs}
          onClose={() => setShowHistory(false)}
          onClear={history.clearHistory}
        />
      )}
    </div>
  );
}
