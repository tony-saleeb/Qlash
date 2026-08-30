/** Satori OG images crash on Arabic ligatures. Keep drawn text Latin. */
export function ogSafeText(value: string | null | undefined, fallback: string): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) return fallback;
  return text.slice(0, 80);
}
