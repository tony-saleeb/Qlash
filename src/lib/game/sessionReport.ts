import type { AnswerOption } from '@/lib/game/types';

export interface ReportAnswerRow {
  player_id: string;
  question_id: string;
  selected_answer_ids: unknown;
  points_awarded: number;
  is_correct: boolean;
  time_taken_ms: number;
}

export interface ReportPlayerRow {
  id: string;
  nickname: string;
  team_name?: string | null;
  score: number;
  streak: number;
}

export interface ReportQuestionRow {
  id: string;
  prompt: string;
  type: string;
  order_index: number;
  answers: AnswerOption[] | unknown;
}

export interface SessionReportInput {
  session: {
    id: string;
    pin: string;
    status: string;
    created_at: string;
    quiz_id: string | null;
    question_order?: unknown;
  };
  quizTitle: string | null;
  teamMode: boolean;
  players: ReportPlayerRow[];
  questions: ReportQuestionRow[];
  answers: ReportAnswerRow[];
}

export interface QuestionReport {
  id: string;
  prompt: string;
  type: string;
  correctLabels: string[];
  answered: number;
  correct: number;
  accuracy: number | null;
  missedBy: { nickname: string; answer: string }[];
}

export interface PlayerReport {
  id: string;
  nickname: string;
  teamName: string | null;
  score: number;
  streak: number;
  correct: number;
  answered: number;
  accuracy: number | null;
}

export interface SessionReport {
  sessionId: string;
  pin: string;
  status: string;
  createdAt: string;
  quizId: string | null;
  quizTitle: string;
  teamMode: boolean;
  playerCount: number;
  questionCount: number;
  scoredQuestionCount: number;
  avgAccuracy: number | null;
  players: PlayerReport[];
  questions: QuestionReport[];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function asAnswers(value: unknown): AnswerOption[] {
  if (!Array.isArray(value)) return [];
  return value as AnswerOption[];
}

function selectedLabel(question: ReportQuestionRow, selected: string[]): string {
  if (question.type === 'type_answer') {
    return selected.join('; ') || '—';
  }
  const answers = asAnswers(question.answers);
  const byId = new Map(answers.map((ans) => [ans.id, ans.text]));
  if (selected.length === 0) return 'No answer';
  return selected.map((id) => byId.get(id) ?? id).join('; ');
}

function correctLabels(question: ReportQuestionRow): string[] {
  if (question.type === 'poll') return [];
  const answers = asAnswers(question.answers);
  if (question.type === 'type_answer') {
    return answers.filter((ans) => ans.is_correct).map((ans) => ans.text).filter(Boolean);
  }
  return answers.filter((ans) => ans.is_correct).map((ans) => ans.text);
}

function orderQuestions(questions: ReportQuestionRow[], questionOrder: unknown): ReportQuestionRow[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const order = asStringArray(questionOrder).filter((id) => byId.has(id));
  if (order.length === 0) {
    return [...questions].sort((a, b) => a.order_index - b.order_index);
  }
  const rest = questions.filter((q) => !order.includes(q.id));
  return [...order.map((id) => byId.get(id)!), ...rest];
}

function pct(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((correct / total) * 100);
}

export function buildSessionReport(input: SessionReportInput): SessionReport {
  const questions = orderQuestions(input.questions, input.session.question_order);
  const scoredQuestions = questions.filter((q) => q.type !== 'poll');
  const answersByPlayer = new Map<string, ReportAnswerRow[]>();
  const answersByQuestion = new Map<string, ReportAnswerRow[]>();

  for (const row of input.answers) {
    const playerRows = answersByPlayer.get(row.player_id) ?? [];
    playerRows.push(row);
    answersByPlayer.set(row.player_id, playerRows);
    const questionRows = answersByQuestion.get(row.question_id) ?? [];
    questionRows.push(row);
    answersByQuestion.set(row.question_id, questionRows);
  }

  const players: PlayerReport[] = [...input.players]
    .sort((a, b) => b.score - a.score)
    .map((player) => {
      const rows = answersByPlayer.get(player.id) ?? [];
      const scored = rows.filter((row) => {
        const q = questions.find((item) => item.id === row.question_id);
        return q && q.type !== 'poll';
      });
      const correct = scored.filter((row) => row.is_correct).length;
      return {
        id: player.id,
        nickname: player.nickname,
        teamName: player.team_name ?? null,
        score: player.score,
        streak: player.streak,
        correct,
        answered: scored.length,
        accuracy: pct(correct, scoredQuestions.length),
      };
    });

  const questionReports: QuestionReport[] = questions.map((question) => {
    const rows = answersByQuestion.get(question.id) ?? [];
    const isPoll = question.type === 'poll';
    const correct = rows.filter((row) => row.is_correct).length;
    const playerById = new Map(input.players.map((p) => [p.id, p]));
    const missedBy = isPoll
      ? []
      : [
          ...rows
            .filter((row) => !row.is_correct)
            .map((row) => ({
              nickname: playerById.get(row.player_id)?.nickname ?? 'Player',
              answer: selectedLabel(question, asStringArray(row.selected_answer_ids)),
            })),
          ...input.players
            .filter((player) => !rows.some((row) => row.player_id === player.id))
            .map((player) => ({ nickname: player.nickname, answer: 'No answer' })),
        ];

    return {
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      correctLabels: correctLabels(question),
      answered: rows.length,
      correct,
      accuracy: isPoll ? null : pct(correct, input.players.length),
      missedBy,
    };
  });

  const accuracyParts = players
    .map((p) => p.accuracy)
    .filter((value): value is number => value !== null);
  const avgAccuracy =
    accuracyParts.length === 0
      ? null
      : Math.round(accuracyParts.reduce((sum, n) => sum + n, 0) / accuracyParts.length);

  return {
    sessionId: input.session.id,
    pin: input.session.pin,
    status: input.session.status,
    createdAt: input.session.created_at,
    quizId: input.session.quiz_id,
    quizTitle: input.quizTitle?.trim() || 'Untitled quiz',
    teamMode: input.teamMode,
    playerCount: input.players.length,
    questionCount: questions.length,
    scoredQuestionCount: scoredQuestions.length,
    avgAccuracy,
    players,
    questions: questionReports,
  };
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function sessionReportToCsv(report: SessionReport): string {
  const lines: string[] = [
    ['Rank', 'Player', 'Team', 'Score', 'Correct', 'Answered', 'Accuracy %'].map(csvCell).join(','),
    ...report.players.map((player, index) =>
      [
        index + 1,
        player.nickname,
        player.teamName ?? '',
        player.score,
        player.correct,
        player.answered,
        player.accuracy ?? '',
      ]
        .map(csvCell)
        .join(',')
    ),
    '',
    ['Question', 'Type', 'Correct answer', 'Answered', 'Correct', 'Accuracy %', 'Missed by'].map(csvCell).join(','),
    ...report.questions.map((question, index) =>
      [
        `${index + 1}. ${question.prompt}`,
        question.type,
        question.correctLabels.join('; '),
        question.answered,
        question.correct,
        question.accuracy ?? '',
        question.missedBy.map((row) => `${row.nickname} (${row.answer})`).join('; '),
      ]
        .map(csvCell)
        .join(',')
    ),
  ];
  return lines.join('\n');
}

export interface QuestionDelta {
  id: string;
  prompt: string;
  before: number | null;
  after: number | null;
  delta: number | null;
}

export interface SessionCompare {
  previousSessionId: string;
  previousCreatedAt: string;
  previousPin: string;
  avgBefore: number | null;
  avgAfter: number | null;
  avgDelta: number | null;
  questions: QuestionDelta[];
  stillHard: QuestionDelta[];
  improved: QuestionDelta[];
}

export const RECAP_ACCURACY_BELOW = 70;

export function recapQuestionIds(report: SessionReport): string[] {
  return report.questions
    .filter((question) => question.type !== 'poll' && question.accuracy !== null && question.accuracy < RECAP_ACCURACY_BELOW)
    .map((question) => question.id);
}

export function compareSessionReports(current: SessionReport, previous: SessionReport): SessionCompare {
  const previousById = new Map(previous.questions.map((q) => [q.id, q]));
  const questions: QuestionDelta[] = current.questions
    .filter((q) => q.type !== 'poll')
    .map((question) => {
      const before = previousById.get(question.id)?.accuracy ?? null;
      const after = question.accuracy;
      const delta =
        before === null || after === null ? null : after - before;
      return {
        id: question.id,
        prompt: question.prompt,
        before,
        after,
        delta,
      };
    });

  const stillHard = [...questions]
    .filter((row) => (row.after !== null && row.after < 50) || (row.delta !== null && row.delta < 0))
    .sort((a, b) => (a.after ?? 101) - (b.after ?? 101))
    .slice(0, 5);

  const improved = [...questions]
    .filter((row) => row.delta !== null && row.delta > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 5);

  const avgBefore = previous.avgAccuracy;
  const avgAfter = current.avgAccuracy;
  const avgDelta =
    avgBefore === null || avgAfter === null ? null : avgAfter - avgBefore;

  return {
    previousSessionId: previous.sessionId,
    previousCreatedAt: previous.createdAt,
    previousPin: previous.pin,
    avgBefore,
    avgAfter,
    avgDelta,
    questions,
    stillHard,
    improved,
  };
}
