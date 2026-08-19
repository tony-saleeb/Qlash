export const CLASH_BEATS = [3, 2, 1, 0] as const;
export const CLASH_BEAT_MS = 750;
export const CLASH_TOTAL_MS = CLASH_BEATS.length * CLASH_BEAT_MS;

export function clashBeatLabel(beat: number, clashWord: string): string {
  return beat === 0 ? clashWord : String(beat);
}
