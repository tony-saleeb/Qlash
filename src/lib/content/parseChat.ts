import { detectCsvDelimiter, parseCsvRecords } from '@/lib/content/csvRecords';
import type { PackQuestion } from '@/lib/content/packs';

const CORRECT_MARK = /(?:\s*(?:\*|✓|✔|✔︎|✅|\(صح\)|\[x\]|\[X\]))\s*$/u;

/** A name is stripped only when a timestamp comes first, so "2. أكمل:" stays a question. */
function stripChatPrefix(line: string): string {
  const bracket = line.match(/^\[[^\]]+\]\s*(?:[^:]{1,40}:\s+)?(.*)$/);
  if (bracket) return bracket[1].trim();
  const timed = line.match(/^\d{1,2}:\d{2}(?::\d{2})?\s+[^:]{1,40}:\s+(.*)$/);
  if (timed) return timed[1].trim();
  return line.trim();
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

function toQuestion(
  prompt: string,
  answers: { text: string; correct: boolean }[],
  extraAnswers: boolean
): { question: PackQuestion | null; warning: string | null } {
  const cleanPrompt = prompt.replace(/^(?:\d+[\).\-\s]+|[سSQ][:：]\s+)/u, '').trim().replace(/[؟?]+$/, (mark) => mark);
  if (!cleanPrompt || answers.length === 0) return { question: null, warning: null };
  const kept = answers.slice(0, 6);
  const warnings: string[] = [];
  if (extraAnswers || answers.length > 6) {
    warnings.push(`"${cleanPrompt}" had more than 6 answers. Only the first 6 were kept.`);
  }
  if (kept.length === 1) {
    return {
      question: { prompt: cleanPrompt, answers: [{ text: kept[0].text, correct: true }] },
      warning: warnings.join(' ') || null,
    };
  }
  const hasMark = kept.some((answer) => answer.correct);
  if (!hasMark) {
    warnings.push(`No answer was starred for "${cleanPrompt}". The first option was marked correct.`);
  }
  const warning = warnings.join(' ') || null;
  return {
    question: {
      prompt: cleanPrompt,
      answers: kept.map((answer, index) => ({
        text: answer.text,
        correct: hasMark ? answer.correct : index === 0,
      })),
    },
    warning,
  };
}

export interface ChatPaste {
  questions: PackQuestion[];
  warnings: string[];
}

/** Parse a WhatsApp / chat paste of numbered questions. Mark the right answer with *. */
export function parseChatPaste(raw: string): ChatPaste {
  const lines = raw.split(/\r?\n/).map((line) => stripChatPrefix(line.trimEnd())).map((line) => line.trim());
  const questions: PackQuestion[] = [];
  const warnings: string[] = [];
  let prompt = '';
  let answers: { text: string; correct: boolean }[] = [];
  let extraAnswers = false;

  const flush = () => {
    const parsed = toQuestion(prompt, answers, extraAnswers);
    if (parsed.question) questions.push(parsed.question);
    if (parsed.warning) warnings.push(parsed.warning);
    prompt = '';
    answers = [];
    extraAnswers = false;
  };

  for (const line of lines) {
    if (!line) {
      if (prompt && answers.length) flush();
      continue;
    }
    const answer = parseAnswerLine(line);
    if (prompt && !isQuestionStart(line)) {
      if (answers.length >= 6) extraAnswers = true;
      else answers.push(answer ?? { text: line.replace(CORRECT_MARK, '').trim(), correct: CORRECT_MARK.test(line) });
      continue;
    }
    if (prompt && answers.length) flush();
    prompt = line;
    answers = [];
    extraAnswers = false;
  }
  flush();
  return { questions, warnings };
}

export function parseChatQuestions(raw: string): PackQuestion[] {
  return parseChatPaste(raw).questions;
}

export function looksLikeCsv(raw: string): boolean {
  const [first] = parseCsvRecords(raw, detectCsvDelimiter(raw));
  if (!first || first.length < 5) return false;
  if (/prompt/i.test(first[0] ?? '')) return true;
  return /(mcq|true_false|type_answer|poll|multi_select)/i.test(first[1] ?? '');
}
