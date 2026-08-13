export const ANSWER_MARK_IDS = ['slash', 'qring', 'bolt', 'chevron', 'spark', 'bars'] as const;
export type AnswerMarkId = (typeof ANSWER_MARK_IDS)[number];

export interface AnswerMarkDef {
  id: AnswerMarkId;
  color: string;
  inkOnMark: boolean;
}

/** Qlash answer identity — not Kahoot RGBY geometry. */
export const ANSWER_MARKS: AnswerMarkDef[] = [
  { id: 'slash', color: '#e11d2e', inkOnMark: false },
  { id: 'qring', color: '#4a2aff', inkOnMark: false },
  { id: 'bolt', color: '#c8f542', inkOnMark: true },
  { id: 'chevron', color: '#0a6b5c', inkOnMark: false },
  { id: 'spark', color: '#ff2d6a', inkOnMark: false },
  { id: 'bars', color: '#0a0c10', inkOnMark: false },
];

const MARK_ALIAS: Record<string, AnswerMarkId> = {
  slash: 'slash',
  qring: 'qring',
  bolt: 'bolt',
  chevron: 'chevron',
  spark: 'spark',
  bars: 'bars',
  triangle: 'slash',
  diamond: 'qring',
  circle: 'bolt',
  square: 'chevron',
  star: 'spark',
  hexagon: 'bars',
};

const COLOR_ALIAS: Record<string, string> = {
  '#e21b3c': '#e11d2e',
  '#e11d2e': '#e11d2e',
  '#1368ce': '#4a2aff',
  '#4a2aff': '#4a2aff',
  '#d89e00': '#c8f542',
  '#c8f542': '#c8f542',
  '#26890c': '#0a6b5c',
  '#0a6b5c': '#0a6b5c',
  '#a855f7': '#ff2d6a',
  '#ff2d6a': '#ff2d6a',
  '#f97316': '#0a0c10',
  '#0a0c10': '#0a0c10',
  '#6366f1': '#4a2aff',
};

export function resolveMarkId(shape: string | null | undefined): AnswerMarkId {
  const key = (shape || '').toLowerCase();
  return MARK_ALIAS[key] ?? 'slash';
}

export function resolveAnswerColor(color: string | null | undefined): string {
  const key = (color || '').trim().toLowerCase();
  return COLOR_ALIAS[key] ?? ANSWER_MARKS[0].color;
}

export function answerUsesInk(color: string): boolean {
  const resolved = resolveAnswerColor(color);
  const def = ANSWER_MARKS.find((m) => m.color === resolved);
  if (def) return def.inkOnMark;
  return resolved === '#c8f542';
}

export function answerMarkClass(color: string): string {
  const resolved = resolveAnswerColor(color);
  if (answerUsesInk(resolved)) return 'text-arena-ink';
  if (resolved === '#0a0c10') return 'text-arena-acid';
  return 'text-white';
}

export function markDefAt(index: number): AnswerMarkDef {
  return ANSWER_MARKS[index % ANSWER_MARKS.length];
}
