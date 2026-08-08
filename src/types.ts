export type RacePhase =
  | 'idle'
  | 'preparing'
  | 'onYourMarks'
  | 'set'
  | 'running'
  | 'finished';

export interface RaceResult {
  id: string;
  timeMs: number;
  /** ISO timestamp of when the race was saved. */
  date: string;
  distanceMeters?: number;
}
