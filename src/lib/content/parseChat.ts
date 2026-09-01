import type { PackQuestion } from '@/lib/content/packs';

const CORRECT_MARK = /(?:\s*(?:\*|✓|✔|✔︎|\(صح\)|\[x\]|\[X\]))\s*$/u;

function stripChatPrefix(line: string): string {
  return line
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+/, '')
    .replace(/^[^:]{1,24}:\s+/, '')
    .trim();
}

function isQuestionStart(line: string): boolean {
  return /^(?:\d+[\).\-\s]+|[سSQ][:：]\s+)/u.test(line);
}

function parseAnswerLine(line: string): { text: string; correct: boolean } | null {
  const marked = CORRECT_MARK.test(line);
  const stripped = line.replace(CORRECT_MARK, '').trim();
  const match = stripped.match(/^(?:[A-Da-dأبجد]|[-*•])[\).\-\s]+(.+)$/u);
  if (match?.[1]) {
    return { text: match[1].trim(), correct: marked };
  }
  if (marked && stripped) {
    return { text: stripped, correct: true };
  }
  return null;
}

function toQuestion(prompt: string, answers: { text: string; correct: boolean }[]): PackQuestion | null {
  const cleanPrompt = prompt.replace(/^(?:\d+[\).\-\s]+|[سSQ][:：]\s+)/u, '').trim().replace(/[؟?]+$/, (mark) => mark);
  if (!cleanPrompt || answers.length === 0) return null;
  const labeled = answers.length >= 2;
  if (!labeled && answers.length === 1) {
    return { prompt: cleanPrompt, answers: [{ text: answers[0].text, correct: true }] };
  }
  if (answers.length < 2) return null;
  const hasMark = answers.some((answer) => answer.correct);
  return {
    prompt: cleanPrompt,
    answers: answers.map((answer, index) => ({
      text: answer.text,
      correct: hasMark ? answer.correct : index === 0,
    })),
  };
}

/** Parse a WhatsApp / chat paste of numbered questions. Mark the right answer with *. */
export function parseChatQuestions(raw: string): PackQuestion[] {
  const lines = raw.split(/\r?\n/).map((line) => stripChatPrefix(line.trimEnd())).map((line) => line.trim());
  const questions: PackQuestion[] = [];
  let prompt = '';
  let answers: { text: string; correct: boolean }[] = [];

  const flush = () => {
    const question = toQuestion(prompt, answers);
    if (question) questions.push(question);
    prompt = '';
    answers = [];
  };

  for (const line of lines) {
    if (!line) {
      if (prompt && answers.length) flush();
      continue;
    }
    const answer = parseAnswerLine(line);
    if (prompt && !isQuestionStart(line)) {
      answers.push(answer ?? { text: line.replace(CORRECT_MARK, '').trim(), correct: CORRECT_MARK.test(line) });
      continue;
    }
    if (prompt && answers.length) flush();
    prompt = line;
    answers = [];
  }
  flush();
  return questions;
}

export function looksLikeCsv(raw: string): boolean {
  const first = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? '';
  if (!first) return false;
  if (/prompt/i.test(first.split(',')[0] ?? '')) return true;
  const commas = first.split(',').length - 1;
  return commas >= 4 && /(mcq|true_false|type_answer|poll|multi_select)/i.test(first);
}
