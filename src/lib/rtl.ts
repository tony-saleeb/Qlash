/** Hebrew, Arabic, and Arabic Presentation Forms. */
const RTL_CHAR =
  /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function containsRtl(text: string | null | undefined): boolean {
  return RTL_CHAR.test(text ?? '');
}

export function textDir(text: string | null | undefined): 'rtl' | 'ltr' {
  return containsRtl(text) ? 'rtl' : 'ltr';
}
