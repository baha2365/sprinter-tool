import { useCallback, useRef, useState } from 'react';

/**
 * The displayed number updates via requestAnimationFrame, but the value
 * that actually gets recorded/saved is always computed from
 * performance.now() timestamps — never from the animation-frame cadence
 * itself — so accuracy doesn't depend on the display's frame rate.
 */
export function useSprintTimer() {
  const [displayMs, setDisplayMs] = useState(0);
  const startTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (startTimestampRef.current === null) return;
    setDisplayMs(performance.now() - startTimestampRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startTimestampRef.current = performance.now();
    setDisplayMs(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  /** Stops the timer and returns the precise elapsed milliseconds. */
  const stop = useCallback((): number => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const finishTimestamp = performance.now();
    const elapsed =
      startTimestampRef.current !== null ? finishTimestamp - startTimestampRef.current : 0;
    setDisplayMs(elapsed);
    return elapsed;
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startTimestampRef.current = null;
    setDisplayMs(0);
  }, []);

  return { displayMs, start, stop, reset };
}
