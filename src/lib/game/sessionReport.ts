import type { AnswerOption } from '@/lib/game/types';

export interface ReportAnswerRow {
  player_id: string;
  question_id: string;
  selected_answer_ids: unknown;
  points_awarded: number;
  is_correct: boolean;
  time_taken_ms: number;
  answered_at?: string | null;
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
    current_question_index?: number | null;
    scored_question_ids?: unknown;
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
  asked: number;
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
function timeMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Questions the room actually reached. Unset fields keep the full list for older callers. */
export function playedQuestionIds(session: SessionReportInput['session']): string[] | null {
  if (session.scored_question_ids === undefined && session.current_question_index == null) {
    return null;
  }
  const order = asStringArray(session.question_order);
  const scored = asStringArray(session.scored_question_ids);
  if (scored.length > 0) {
    const inOrder = order.filter((id) => scored.includes(id));
    const extra = scored.filter((id) => !inOrder.includes(id));
    return [...inOrder, ...extra];
  }
  if (order.length === 0) return [];
  const index = session.current_question_index;
  const through = typeof index === 'number' && index >= 0 ? index : order.length - 1;
  return order.slice(0, through + 1);
}

function answerTimes(rows: ReportAnswerRow[]): number[] {
  return rows.map((row) => timeMs(row.answered_at)).filter((value): value is number => value !== null);
}

function presentPlayerIds(
  players: ReportPlayerRow[],
  questionId: string,
  playedIds: string[],
  answersByQuestion: Map<string, ReportAnswerRow[]>
): Set<string> {
  const rows = answersByQuestion.get(questionId) ?? [];
  const answered = new Set(rows.map((row) => row.player_id));
  const times = answerTimes(rows);
  const endedAt = times.length > 0 ? Math.max(...times) : null;
  let nextStartedAt: number | null = null;
  if (endedAt === null) {
    const later = playedIds.slice(playedIds.indexOf(questionId) + 1);
    for (const laterId of later) {
      const laterTimes = answerTimes(answersByQuestion.get(laterId) ?? []);
      if (laterTimes.length > 0) {
        nextStartedAt = Math.min(...laterTimes);
        break;
      }
    }
  }

  const present = new Set<string>();
  for (const player of players) {
    if (answered.has(player.id)) {
      present.add(player.id);
      continue;
    }
    const joined = timeMs(player.joined_at);
    if (joined === null) {
      present.add(player.id);
      continue;
    }
    if (endedAt !== null) {
      if (joined <= endedAt) present.add(player.id);
      continue;
    }
    if (nextStartedAt !== null) {
      if (joined < nextStartedAt) present.add(player.id);
      continue;
    }
    present.add(player.id);
  }
  return present;
}

  if (total <= 0) return null;
  return Math.round((correct / total) * 100);
}

export function buildSessionReport(input: SessionReportInput): SessionReport {
  const questions = orderQuestions(input.questions, input.session.question_order);
  const ordered = orderQuestions(input.questions, input.session.question_order);
  const playedIds = playedQuestionIds(input.session);
  const questions =
    playedIds === null ? ordered : ordered.filter((question) => playedIds.includes(question.id));
  const playedOrder = playedIds ?? questions.map((question) => question.id);
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
      const asked = scoredQuestions.filter((question) =>
        presentPlayerIds(input.players, question.id, playedOrder, answersByQuestion).has(player.id)
      ).length;
      return {
        id: player.id,
        nickname: player.nickname,
        teamName: player.team_name ?? null,
        score: player.score,
        streak: player.streak,
        correct,
        answered: scored.length,
        asked,
        accuracy: pct(correct, asked),
    });

  const questionReports: QuestionReport[] = questions.map((question) => {
    const rows = answersByQuestion.get(question.id) ?? [];
    const isPoll = question.type === 'poll';
    const correct = rows.filter((row) => row.is_correct).length;
    const playerById = new Map(input.players.map((p) => [p.id, p]));
    const missedBy = isPoll
    const present = presentPlayerIds(input.players, question.id, playedOrder, answersByQuestion);
    const missedBy = isPoll
      ? []
      : [
          ...rows
            .filter((row) => !row.is_correct && present.has(row.player_id))
            .map((row) => ({
              nickname: playerById.get(row.player_id)?.nickname ?? 'Player',
              answer: selectedLabel(question, asStringArray(row.selected_answer_ids)),
            })),
          ...input.players
            .filter((player) => present.has(player.id) && !rows.some((row) => row.player_id === player.id))
        ];

    return {
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      correctLabels: correctLabels(question),
      answered: rows.length,
      correct,
      accuracy: isPoll ? null : pct(correct, input.players.length),
      accuracy: isPoll ? null : pct(correct, present.size),
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
const CSV_FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (CSV_FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
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
  return `\uFEFF${lines.join('\n')}`;

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
