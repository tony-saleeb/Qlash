import { describe, expect, it } from 'vitest';
import { looksLikeCsv, parseChatPaste, parseChatQuestions } from '@/lib/content/parseChat';

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

  it('treats ✅ as a correct-answer mark', () => {
    const [question] = parseChatQuestions(`
1. أول شهر قبطي؟
أ) بابه
ب) توت ✅
ج) كيهك
`);
    expect(question?.answers.find((answer) => answer.correct)?.text).toBe('توت');
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
    const pasted = parseChatPaste('1. Color of the sky?\nBlue\nGreen\nRed');
    expect(pasted.questions[0]?.answers[0]?.correct).toBe(true);
    expect(pasted.questions[0]?.answers.filter((answer) => answer.correct)).toHaveLength(1);
    expect(pasted.warnings[0]).toMatch(/No answer was starred/);
  });

  it('keeps a numbered Arabic prompt that contains a colon', () => {
    const questions = parseChatQuestions(`
1. سؤال أول؟
أ) واحد *

2. أكمل: الجملة دي
أ) نعم *
ب) لا
`);
    expect(questions).toHaveLength(2);
    expect(questions[1]?.prompt).toContain('أكمل');
  });

  it('keeps only the first six answers', () => {
    const pasted = parseChatPaste(`1. Pick?
A. one *
B. two
C. three
D. four
E. five
F. six
G. seven
H. eight`);
    expect(pasted.questions[0]?.answers).toHaveLength(6);
    expect(pasted.warnings[0]).toMatch(/first 6/);
  });
});

describe('looksLikeCsv', () => {
  it('detects the editor CSV template', () => {
    expect(looksLikeCsv('Prompt, Type, TimeLimit, Points, CorrectKey, A, B')).toBe(true);
    expect(looksLikeCsv('"Who?","mcq",20,1000,"1","A","B"')).toBe(true);
    expect(looksLikeCsv('Prompt;Type;Time;Points;Correct;A;B')).toBe(true);
    expect(looksLikeCsv('1. عاصمة مصر إيه؟\nالقاهرة *')).toBe(false);
  });
});
