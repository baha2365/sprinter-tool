import { useCallback, useEffect, useState } from 'react';
import type { RaceResult } from '../types';

const STORAGE_KEY = 'sprint-timer.history.v1';

function loadFromStorage(): RaceResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read sprint history', err);
    return [];
  }
}

export function useHistory() {
  const [history, setHistory] = useState<RaceResult[]>([]);

  useEffect(() => {
    setHistory(loadFromStorage());
  }, []);

  const persist = useCallback((next: RaceResult[]) => {
    setHistory(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('Failed to save sprint history', err);
    }
  }, []);

  const addResult = useCallback(
    (timeMs: number, distanceMeters?: number) => {
      const entry: RaceResult = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timeMs,
        date: new Date().toISOString(),
        distanceMeters,
      };
      persist([entry, ...history]);
      return entry;
    },
    [history, persist]
  );

  const clearHistory = useCallback(() => persist([]), [persist]);

  const personalBestMs = history.length > 0 ? Math.min(...history.map((h) => h.timeMs)) : null;

  return { history, addResult, clearHistory, personalBestMs };
}
