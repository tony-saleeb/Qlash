import { ANSWER_MARKS } from '@/lib/game/marks';

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
    double_points_rounds: string[]; // question indices or IDs
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

export function createDefaultQuestion(
  type: 'mcq' | 'true_false' | 'multi_select' | 'type_answer' | 'poll'
): Question {
  let answers: AnswerOption[] = [];

  if (type === 'mcq' || type === 'multi_select' || type === 'poll') {
    answers = DEFAULT_ANSWERS.slice(0, 4).map((ans) => ({ ...ans }));
  } else if (type === 'true_false') {
    answers = [
      { id: '1', text: 'True', is_correct: false, color: ANSWER_MARKS[0].color, shape: ANSWER_MARKS[0].id },
      { id: '2', text: 'False', is_correct: false, color: ANSWER_MARKS[1].color, shape: ANSWER_MARKS[1].id },
    ];
  } else if (type === 'type_answer') {
    // Type answer doesn't display choices. Players type input which is fuzzy checked.
    // We keep a single placeholder answer where correct text answer options are defined.
    answers = [
      { id: '1', text: '', is_correct: true, color: ANSWER_MARKS[1].color, shape: ANSWER_MARKS[1].id },
    ];
  }

  return {
    type,
    prompt: '',
    media_url: '',
    media_type: null,
    time_limit_seconds: 20,
    points_base: 1000,
    scoring_type: type === 'poll' ? 'none' : 'linear',
    answers,
  };
}

export function parseCsvQuestions(csvText: string): Question[] {
  const lines = csvText.split('\n');
  const importedQs: Question[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // basic CSV parser handling double quotes
    const cells: string[] = [];
    let currentCell = '';
    let insideQuote = false;

    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        cells.push(currentCell.trim().replace(/^"|"$/g, ''));
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim().replace(/^"|"$/g, ''));

    // Skip CSV headers if match
    if (i === 0 && cells[0].toLowerCase().includes('prompt')) {
      continue;
    }

    if (cells.length < 5) {
      throw new Error(`Line ${i + 1} does not have enough columns. Minimum format: Prompt, Type, TimeLimit, Points, CorrectIndex/CorrectText, Choices...`);
    }

    const [prompt, typeInput, timeLimit, points, gradingField, ...choices] = cells;
    const type = (typeInput.trim().toLowerCase() as Question['type']) || 'mcq';
    const limitSec = parseInt(timeLimit) || 20;
    const basePts = parseInt(points) || 1000;

    let answers: AnswerOption[] = [];

    if (type === 'type_answer') {
      answers = [{ id: '1', text: gradingField, is_correct: true, color: ANSWER_MARKS[1].color, shape: ANSWER_MARKS[1].id }];
    } else if (type === 'true_false') {
      const correctVal = gradingField.trim().toLowerCase();
      const isTrueCorrect = correctVal === 'true' || correctVal === '1' || correctVal === 't';
      answers = [
        { id: '1', text: 'True', is_correct: isTrueCorrect, color: ANSWER_MARKS[0].color, shape: ANSWER_MARKS[0].id },
        { id: '2', text: 'False', is_correct: !isTrueCorrect, color: ANSWER_MARKS[1].color, shape: ANSWER_MARKS[1].id },
      ];
    } else if (type === 'poll') {
      answers = choices.slice(0, 6).map((c, idx) => ({
        id: (idx + 1).toString(),
        text: c,
        is_correct: false,
        color: DEFAULT_ANSWERS[idx].color,
        shape: DEFAULT_ANSWERS[idx].shape,
      }));
    } else if (type === 'mcq' || type === 'multi_select') {
      // parse grading field: comma-separated index (1-based index)
      const correctIndices = gradingField.split(';').map((idx) => parseInt(idx.trim()) - 1);
      answers = choices.slice(0, 6).map((c, idx) => ({
        id: (idx + 1).toString(),
        text: c,
        is_correct: correctIndices.includes(idx),
        color: DEFAULT_ANSWERS[idx].color,
        shape: DEFAULT_ANSWERS[idx].shape,
      }));
    }

    importedQs.push({
      type,
      prompt,
      media_url: null,
      media_type: null,
      time_limit_seconds: limitSec,
      points_base: basePts,
      scoring_type: type === 'poll' ? 'none' : 'linear',
      answers,
    });
  }

  return importedQs;
}
