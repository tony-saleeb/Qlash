/** Team names share the nickname cleaner and a slightly wider cap. */
export const TEAM_NAME_MAX_LEN = 40;

/**
 * Controls, bidi overrides, and zero-width characters. Stripped before a
 * nickname is compared, so "Ada" and "Ada" plus an invisible mark are one name.
 */
const INVISIBLE =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFE00-\uFE0F\uFEFF\uFFF9-\uFFFB\u{E0000}-\u{E007F}]/gu;

/** A display name, or null when the value is not a string. */
export function cleanPlayerName(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const source = value.length > 256 ? value.slice(0, 256) : value;
  return source.replace(INVISIBLE, '').trim().slice(0, maxLen);
}
