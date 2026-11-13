import { ANSWER_MARKS } from '@/lib/game/marks';
import { MAX_CHOICES, MAX_QUIZ_QUESTIONS, MIN_CHOICES } from '@/lib/game/questionRules';
import type { PackQuestion } from '@/lib/content/draftQuestion';

export const MAX_CATEGORY_NAME = 40;
export const MAX_BANK_PROMPT = 150;
export const MAX_BANK_ANSWER = 80;
export const MAX_BANK_QUESTIONS = 500;
export const MAX_QUESTION_BANKS = 50;

export function normalizeCategoryName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Name the category.');
  if (clean.length > MAX_CATEGORY_NAME) throw new Error('Category name is too long.');
  return clean;
}

export function normalizeBankQuestion(
  prompt: string,
  answers: readonly { text: string; correct: boolean }[]
): PackQuestion {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error('Question text is empty.');
  if (cleanPrompt.length > MAX_BANK_PROMPT) throw new Error('Question text is too long.');
  const kept = answers
    .map((answer) => ({ text: answer.text.trim(), correct: answer.correct === true }))
    .filter((answer) => answer.text.length > 0);
  if (kept.length < MIN_CHOICES) throw new Error('Add at least two answers.');
  if (kept.length > MAX_CHOICES) throw new Error('Six answers is the maximum.');
  if (kept.some((answer) => answer.text.length > MAX_BANK_ANSWER)) throw new Error('An answer is too long.');
  if (kept.filter((answer) => answer.correct).length !== 1) throw new Error('Mark one correct answer.');
  return { prompt: cleanPrompt, answers: kept };
}

/** Fisher–Yates, then the first `count` items. The same question is never drawn twice. */
export function pickRandom<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('Pick at least one question.');
  if (count > MAX_QUIZ_QUESTIONS) {
    throw new Error(`A quiz can have at most ${MAX_QUIZ_QUESTIONS} questions.`);
  }
  if (count > items.length) throw new Error(`This category only has ${items.length} questions.`);
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy.slice(0, count);
}

export function bankToQuestionRows(quizId: string, questions: readonly PackQuestion[]) {
  const colors = ANSWER_MARKS.map((mark) => mark.color);
  const shapes = ANSWER_MARKS.map((mark) => mark.id);
  return questions.map((question, index) => ({
    quiz_id: quizId,
    order_index: index,
    type: 'mcq',
    prompt: question.prompt,
    media_url: null,
    media_type: null,
    time_limit_seconds: 20,
    points_base: 1000,
    scoring_type: 'linear',
    answers: question.answers.map((answer, answerIndex) => ({
      id: String(answerIndex + 1),
      text: answer.text,
      is_correct: answer.correct,
      color: colors[answerIndex % colors.length],
      shape: shapes[answerIndex % shapes.length],
    })),
  }));
}
