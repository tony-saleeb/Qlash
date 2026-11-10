import { ANSWER_MARKS } from '@/lib/game/marks';
import type { Locale } from '@/lib/i18n/locale';
import { detectCsvDelimiter, parseCsvRecords } from '@/lib/content/csvRecords';
import { looksLikeCsv, parseChatPaste } from '@/lib/content/parseChat';
import type { PackQuestion } from '@/lib/content/packs';

export type AnswerShape = 'slash' | 'qring' | 'bolt' | 'chevron' | 'spark' | 'bars';

export interface AnswerOption {
  id: string;
  text: string;
  is_correct: boolean;
  color: string;
  shape: AnswerShape | string;
}

export interface Question {
  id?: string;
  type: 'mcq' | 'true_false' | 'multi_select' | 'type_answer' | 'poll';
  prompt: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  time_limit_seconds: number;
  points_base: number;
  scoring_type: 'linear' | 'flat' | 'none';
  answers: AnswerOption[];
}

export interface QuizEditorClientProps {
  quiz: {
    id: string;
    title: string;
    description: string;
    theme: Record<string, unknown>;
    randomize_questions: boolean;
    randomize_answers: boolean;
    team_mode: boolean;
    double_points_rounds: string[]; // question ids; older rows may still hold editor positions
    updated_at?: string;
  };
  initialQuestions: Question[];
}

// Qlash marks — slash, Q-ring, bolt, chevron, spark, bars
export const DEFAULT_ANSWERS: AnswerOption[] = ANSWER_MARKS.map((mark, i) => ({
  id: String(i + 1),
  text: '',
  is_correct: false,
  color: mark.color,
  shape: mark.id,
}));

/** Next option id is one past the highest existing id, so a removed slot is never reused. */
export function nextAnswerOption(existing: readonly AnswerOption[]): AnswerOption | null {
  if (existing.length >= DEFAULT_ANSWERS.length) return null;
  const used = new Set(existing.map((answer) => answer.id));
  let n =
    existing.reduce((max, answer) => {
      const value = Number(answer.id);
      return Number.isInteger(value) && value > max ? value : max;
    }, 0) + 1;
  while (used.has(String(n))) n += 1;
  const template = DEFAULT_ANSWERS[existing.length];
  return { ...template, id: String(n), text: '', is_correct: false };
}

export function hasDuplicateAnswerIds(answers: readonly { id: string }[]): boolean {
  return new Set(answers.map((answer) => answer.id)).size !== answers.length;
}

export function newQuestionId(): string {
  return crypto.randomUUID();
}

/**
 * A question with no id is inserted on every save, and the next save then
 * deletes that row. Stamp an id before the first save so the row is updated.
 */
export function withQuestionId(question: Question): Question {
  return question.id ? question : { ...question, id: newQuestionId() };
}

/** Copy server ids back onto the editor list, in the same order they were saved. */
export function withSavedQuestionIds(questions: Question[], questionIds: readonly string[]): Question[] {
  return questions.map((question, index) => {
    const id = questionIds[index];
    return id ? { ...question, id } : question;
  });
}

/** True when rendering the editor would let a save delete every question. */
export function questionsFailedToLoad(error: unknown, questions: unknown): boolean {
  return Boolean(error) || questions == null;
}

const CHOICE_TYPES = new Set<Question['type']>(['mcq', 'multi_select', 'poll']);

/**
 * Changing MCQ to multi-select used to replace the options with blanks.
 * Choice types keep the text and the correct flags. Other types keep
 * whatever text already sits in each slot.
 */
export function questionAfterTypeChange(question: Question, type: Question['type'], locale: Locale = 'en'): Question {
  const scoring_type =
    type === 'poll' ? 'none' : question.type === 'poll' ? 'linear' : question.scoring_type;

  if (CHOICE_TYPES.has(type) && CHOICE_TYPES.has(question.type)) {
    return { ...question, type, scoring_type, answers: question.answers.map((answer) => ({ ...answer })) };
  }

  if (type === 'type_answer') {
    const kept = question.answers.find((answer) => answer.is_correct)?.text ?? question.answers[0]?.text ?? '';
    const slot = createDefaultQuestion('type_answer', locale).answers[0];
    return {
      ...question,
      type,
      scoring_type,
      answers: [{ ...slot, id: question.answers[0]?.id ?? slot.id, text: kept }],
    };
  }

  const template = createDefaultQuestion(type, locale);
  return {
    ...question,
    type,
    scoring_type,
    answers: template.answers.map((answer, index) => {
      const previous = question.answers[index];
      if (!previous) return answer;
      return {
        ...answer,
        id: previous.id,
        text: previous.text.trim() ? previous.text : answer.text,
        is_correct: previous.is_correct,
      };
    }),
  };
}

/** Apply a late upload to the question that started it, not whatever is on screen now. */
export function patchQuestionById(
  questions: readonly Question[],
  questionId: string,
  fields: Partial<Question>
): Question[] {
  return questions.map((question) =>
    question.id === questionId ? { ...question, ...fields } : question
  );
}

export function questionsWithoutIndex(questions: readonly Question[], index: number): Question[] {
  return questions.filter((_, item) => item !== index);
}

export function questionsWithInsert(
  questions: readonly Question[],
  index: number,
  question: Question
): Question[] {
  const next = [...questions];
  next.splice(Math.max(0, index), 0, question);
  return next;
}

/** Back leaves immediately when nothing changed. A dirty editor asks first. */
export function allowEditorLeave(dirty: boolean, confirmLeave: () => boolean): boolean {
  if (!dirty) return true;
  return confirmLeave();
}

export function trueFalseLabels(locale: Locale = 'en'): [string, string] {
  return locale === 'ar' ? ['صح', 'خطأ'] : ['True', 'False'];
}

export function createDefaultQuestion(
  type: 'mcq' | 'true_false' | 'multi_select' | 'type_answer' | 'poll',
  locale: Locale = 'en'
): Question {
  let answers: AnswerOption[] = [];

  if (type === 'mcq' || type === 'multi_select' || type === 'poll') {
    answers = DEFAULT_ANSWERS.slice(0, 4).map((ans) => ({ ...ans }));
  } else if (type === 'true_false') {
    answers = [
      { id: '1', text: trueFalseLabels(locale)[0], is_correct: false, color: ANSWER_MARKS[0].color, shape: ANSWER_MARKS[0].id },
      { id: '2', text: trueFalseLabels(locale)[1], is_correct: false, color: ANSWER_MARKS[1].color, shape: ANSWER_MARKS[1].id },
    ];
  } else if (type === 'type_answer') {
    // Type answer doesn't display choices. Grading folds case and Arabic letter variants.
    // We keep a single placeholder answer where correct text answer options are defined.
    answers = [
      { id: '1', text: '', is_correct: true, color: ANSWER_MARKS[1].color, shape: ANSWER_MARKS[1].id },
    ];
  }

  return withQuestionId({
    type,
    prompt: '',
    media_url: '',
    media_type: null,
    time_limit_seconds: 20,
    points_base: 1000,
    scoring_type: type === 'poll' ? 'none' : 'linear',
    answers,
  });
}

/**
 * Imported rows must stay inside the editor's own ranges. A zero or negative
 * time limit grades every answer as late and kills the round for the whole
 * room, so an unusable CSV value falls back to the default instead.
 */
export const TIME_LIMIT_MIN_SECONDS = 5;
export const TIME_LIMIT_MAX_SECONDS = 120;
export const POINTS_BASE_MAX = 2000;

export function clampTimeLimit(seconds: number, fallback = 20): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(TIME_LIMIT_MAX_SECONDS, Math.max(TIME_LIMIT_MIN_SECONDS, Math.round(seconds)));
}

export function clampPointsBase(points: number, fallback = 1000): number {
  if (!Number.isFinite(points) || points < 0) return fallback;
  return Math.min(POINTS_BASE_MAX, Math.round(points));
}

const QUESTION_TYPES = new Set<Question['type']>(['mcq', 'true_false', 'multi_select', 'type_answer', 'poll']);

function trueFalseKey(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (['true', '1', 't', 'صح', 'صحيح', 'نعم'].includes(value)) return true;
  if (['false', '0', 'f', 'خطأ', 'غلط', 'لا'].includes(value)) return false;
  return null;
}

function correctIndexes(raw: string, choiceCount: number, row: number): number[] {
  const parts = raw.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Row ${row}: missing answer key.`);
  }
  return parts.map((part) => {
    if (!/^\d+$/.test(part)) throw new Error(`Row ${row}: unknown answer key "${part}".`);
    const index = Number(part) - 1;
    if (index < 0 || index >= choiceCount) {
      throw new Error(`Row ${row}: answer key ${part} is outside the choices.`);
    }
    return index;
  });
}

export function parseCsvQuestions(csvText: string): Question[] {
  const records = parseCsvRecords(csvText, detectCsvDelimiter(csvText));
  const importedQs: Question[] = [];
  const problems: string[] = [];

  records.forEach((cells, index) => {
    const row = index + 1;
    if (index === 0 && cells[0].toLowerCase().includes('prompt')) return;

    try {
      if (cells.length < 5) {
        throw new Error(
          `Row ${row} does not have enough columns. Minimum format: Prompt, Type, TimeLimit, Points, CorrectIndex/CorrectText, Choices...`
        );
      }

      const [prompt, typeInput, timeLimit, points, gradingField, ...choices] = cells;
      const typeName = typeInput.trim().toLowerCase();
      if (!QUESTION_TYPES.has(typeName as Question['type'])) {
        throw new Error(`Row ${row}: unknown question type "${typeInput.trim()}".`);
      }
      const type = typeName as Question['type'];
      const limitSec = clampTimeLimit(parseInt(timeLimit, 10));
      const basePts = clampPointsBase(parseInt(points, 10));
      const keptChoices = choices.slice(0, 6);
      while (keptChoices.length > 0 && keptChoices[keptChoices.length - 1].trim() === '') keptChoices.pop();

      let answers: AnswerOption[] = [];

      if (type === 'type_answer') {
        if (!gradingField.trim()) throw new Error(`Row ${row}: the typed answer is empty.`);
        answers = [{ id: '1', text: gradingField, is_correct: true, color: ANSWER_MARKS[1].color, shape: ANSWER_MARKS[1].id }];
      } else if (type === 'true_false') {
        const isTrueCorrect = trueFalseKey(gradingField);
        if (isTrueCorrect === null) {
          throw new Error(`Row ${row}: unknown true/false key "${gradingField.trim()}".`);
        }
        answers = [
          { id: '1', text: 'True', is_correct: isTrueCorrect, color: ANSWER_MARKS[0].color, shape: ANSWER_MARKS[0].id },
          { id: '2', text: 'False', is_correct: !isTrueCorrect, color: ANSWER_MARKS[1].color, shape: ANSWER_MARKS[1].id },
        ];
      } else if (type === 'poll') {
        if (keptChoices.length < 2) throw new Error(`Row ${row}: a poll needs at least two choices.`);
        answers = keptChoices.map((choice, idx) => ({
          id: (idx + 1).toString(),
          text: choice,
          is_correct: false,
          color: DEFAULT_ANSWERS[idx].color,
          shape: DEFAULT_ANSWERS[idx].shape,
        }));
      } else {
        if (keptChoices.length < 2) throw new Error(`Row ${row}: add at least two choices.`);
        const correct = correctIndexes(gradingField, keptChoices.length, row);
        answers = keptChoices.map((choice, idx) => ({
          id: (idx + 1).toString(),
          text: choice,
          is_correct: correct.includes(idx),
          color: DEFAULT_ANSWERS[idx].color,
          shape: DEFAULT_ANSWERS[idx].shape,
        }));
      }

      importedQs.push(
        withQuestionId({
          type,
          prompt,
          media_url: null,
          media_type: null,
          time_limit_seconds: limitSec,
          points_base: basePts,
          scoring_type: type === 'poll' ? 'none' : 'linear',
          answers,
        })
      );
    } catch (err: unknown) {
      problems.push(err instanceof Error ? err.message : `Row ${row} could not be read.`);
    }
  });

  if (problems.length > 0) throw new Error(problems.join('\n'));
  return importedQs;
}

export function packQuestionToEditor(question: PackQuestion): Question {
  const type = question.answers.length === 1 ? 'type_answer' : 'mcq';
  return withQuestionId({
    type,
    prompt: question.prompt,
    media_url: null,
    media_type: null,
    time_limit_seconds: 20,
    points_base: 1000,
    scoring_type: 'linear',
    answers: question.answers.map((answer, index) => ({
      id: String(index + 1),
      text: answer.text,
      is_correct: answer.correct,
      color: DEFAULT_ANSWERS[index % DEFAULT_ANSWERS.length].color,
      shape: DEFAULT_ANSWERS[index % DEFAULT_ANSWERS.length].shape,
    })),
  });
}

export function importQuizText(raw: string): { questions: Question[]; warnings: string[] } {
  if (looksLikeCsv(raw)) return { questions: parseCsvQuestions(raw), warnings: [] };
  const pasted = parseChatPaste(raw);
  const questions = pasted.questions.map(packQuestionToEditor);
  if (questions.length === 0) {
    throw new Error('No questions found. Number them and mark the right answer with *.');
  }
  return { questions, warnings: pasted.warnings };
}

export function importQuestionsFromText(raw: string): Question[] {
  return importQuizText(raw).questions;
}
