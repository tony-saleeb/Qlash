export const MAX_QUIZ_QUESTIONS = 100;
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;
export const MIN_TIME_SECONDS = 5;
export const MAX_TIME_SECONDS = 240;
export const MAX_POINTS = 2000;

const QUESTION_TYPES = new Set(['mcq', 'true_false', 'multi_select', 'type_answer', 'poll']);

export interface PlayableAnswer {
  text?: string | null;
  is_correct?: boolean | null;
}

export interface PlayableQuestion {
  type: string;
  media_url?: string | null;
  time_limit_seconds: number | null;
  points_base: number | null;
  answers: PlayableAnswer[];
}

function whole(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** The first reason a question cannot be graded, or null when it can. */
export function questionIssue(question: PlayableQuestion, index: number): string | null {
  const label = `Question ${index + 1}`;
  if (!QUESTION_TYPES.has(question.type)) return `${label} has an unknown type.`;

  if (!whole(question.time_limit_seconds) || question.time_limit_seconds < MIN_TIME_SECONDS || question.time_limit_seconds > MAX_TIME_SECONDS) {
    return `${label} needs a time limit from ${MIN_TIME_SECONDS} to ${MAX_TIME_SECONDS} seconds.`;
  }
  if (!whole(question.points_base) || question.points_base < 0 || question.points_base > MAX_POINTS) {
    return `${label} needs points from 0 to ${MAX_POINTS}.`;
  }

  const media = question.media_url?.trim() ?? '';
  if (media && !media.startsWith('https://')) return `${label} media must be an https link.`;

  const answers = question.answers ?? [];
  const correct = answers.filter((answer) => answer.is_correct);

  if (question.type === 'type_answer') {
    const key = correct.map((answer) => (answer.text ?? '').trim()).find((text) => text.length > 0);
    if (!key) return `${label} needs an accepted answer.`;
    return null;
  }

  if (answers.length < MIN_CHOICES || answers.length > MAX_CHOICES) {
    return `${label} needs ${MIN_CHOICES} to ${MAX_CHOICES} answers.`;
  }
  if (answers.some((answer) => !(answer.text ?? '').trim())) {
    return `${label} has an empty answer.`;
  }
  if (question.type === 'poll') return null;
  if (question.type === 'multi_select') {
    if (correct.length < 1) return `${label} needs at least one correct answer.`;
    return null;
  }
  if (correct.length !== 1) return `${label} needs exactly one correct answer.`;
  return null;
}

export function assertPlayableQuestions(questions: readonly PlayableQuestion[]): void {
  if (questions.length > MAX_QUIZ_QUESTIONS) {
    throw new Error(`A quiz can have at most ${MAX_QUIZ_QUESTIONS} questions.`);
  }
  questions.forEach((question, index) => {
    const issue = questionIssue(question, index);
    if (issue) throw new Error(issue);
  });
}
