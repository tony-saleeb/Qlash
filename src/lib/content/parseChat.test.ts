import { describe, expect, it } from 'vitest';
import { looksLikeCsv, parseChatQuestions } from '@/lib/content/parseChat';

describe('parseChatQuestions', () => {
  it('reads numbered Arabic questions with a star on the right answer', () => {
    const questions = parseChatQuestions(`
1. عاصمة مصر إيه؟
القاهرة *
الإسكندرية
أسوان
الأقصر

2) الأسبوع فيه كام يوم؟
أ) 5
ب) 7 *
ج) 8
`);
    expect(questions).toHaveLength(2);
    expect(questions[0]?.prompt).toContain('عاصمة مصر');
    expect(questions[0]?.answers.find((answer) => answer.correct)?.text).toBe('القاهرة');
    expect(questions[1]?.answers.find((answer) => answer.correct)?.text).toBe('7');
  });

  it('reads A/B/C English lists and WhatsApp name prefixes', () => {
    const questions = parseChatQuestions(`
[12:03] Mona: 1) Where was Jesus born?
A. Nazareth
B. Bethlehem *
C. Jerusalem
`);
    expect(questions[0]?.answers.find((answer) => answer.correct)?.text).toBe('Bethlehem');
  });

  it('treats a question plus one answer as type-in', () => {
    const [question] = parseChatQuestions('س: أول إنجيل إيه؟\nمتى');
    expect(question?.answers).toEqual([{ text: 'متى', correct: true }]);
  });

  it('defaults to the first answer when nothing is starred', () => {
    const [question] = parseChatQuestions('1. Color of the sky?\nBlue\nGreen\nRed');
    expect(question?.answers[0]?.correct).toBe(true);
    expect(question?.answers.filter((answer) => answer.correct)).toHaveLength(1);
  });
});

describe('looksLikeCsv', () => {
  it('detects the editor CSV template', () => {
    expect(looksLikeCsv('Prompt, Type, TimeLimit, Points, CorrectKey, A, B')).toBe(true);
    expect(looksLikeCsv('"Who?","mcq",20,1000,"1","A","B"')).toBe(true);
    expect(looksLikeCsv('1. عاصمة مصر إيه؟\nالقاهرة *')).toBe(false);
  });
});
