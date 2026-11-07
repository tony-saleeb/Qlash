/** Excel's Arabic ANSI export is windows-1256. UTF-8 reads it as U+FFFD. */
export function decodeQuizFileText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('windows-1256').decode(bytes);
  } catch {
    return utf8;
  }
}
