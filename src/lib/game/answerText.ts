/**
 * Fold a typed answer so القاهرة and القاهره match, including short vowels.
 * Live grading calls the SQL copy, public.normalize_answer_text.
 */
export function normalizeAnswerText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}
