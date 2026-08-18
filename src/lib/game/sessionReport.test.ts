import { describe, expect, it } from 'vitest';
import { buildSessionReport, compareSessionReports, sessionReportToCsv } from '@/lib/game/sessionReport';

const capital = {
  id: 'q1',
  prompt: 'Capital of France?',
  type: 'mcq',
  order_index: 0,
  answers: [
    { id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash', is_correct: true },
    { id: 'b', text: 'Lyon', color: '#4a2aff', shape: 'qring', is_correct: false },
  ],
};

const poll = {
  id: 'q2',
  prompt: 'Favorite color?',
  type: 'poll',
  order_index: 1,
  answers: [
    { id: 'red', text: 'Red', color: '#e11d2e', shape: 'slash', is_correct: false },
    { id: 'blue', text: 'Blue', color: '#4a2aff', shape: 'qring', is_correct: false },
  ],
};

describe('buildSessionReport', () => {
  it('ranks players, scores accuracy against non-poll questions, and lists misses', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '847291',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
        question_order: ['q1', 'q2'],
      },
      quizTitle: 'Geo',
      teamMode: true,
      players: [
        { id: 'p1', nickname: 'Ada', team_name: 'Red', score: 1800, streak: 2 },
        { id: 'p2', nickname: 'Bob', team_name: 'Blue', score: 0, streak: 0 },
      ],
      questions: [capital, poll],
      answers: [
        {
          player_id: 'p1',
          question_id: 'q1',
          selected_answer_ids: ['a'],
          points_awarded: 1800,
          is_correct: true,
          time_taken_ms: 1200,
        },
        {
          player_id: 'p2',
          question_id: 'q1',
          selected_answer_ids: ['b'],
          points_awarded: 0,
          is_correct: false,
          time_taken_ms: 4000,
        },
        {
          player_id: 'p1',
          question_id: 'q2',
          selected_answer_ids: ['red'],
          points_awarded: 0,
          is_correct: false,
          time_taken_ms: 800,
        },
      ],
    });

    expect(report.players[0]).toMatchObject({ nickname: 'Ada', correct: 1, answered: 1, accuracy: 100 });
    expect(report.players[1]).toMatchObject({ nickname: 'Bob', correct: 0, accuracy: 0 });
    expect(report.scoredQuestionCount).toBe(1);
    expect(report.questions[0].accuracy).toBe(50);
    expect(report.questions[0].missedBy).toEqual([{ nickname: 'Bob', answer: 'Lyon' }]);
    expect(report.questions[1].accuracy).toBeNull();
    expect(report.avgAccuracy).toBe(50);
  });

  it('follows session question_order when present', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '111111',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
        question_order: ['q2', 'q1'],
      },
      quizTitle: 'Geo',
      teamMode: false,
      players: [{ id: 'p1', nickname: 'Ada', score: 0, streak: 0 }],
      questions: [capital, poll],
      answers: [],
    });
    expect(report.questions.map((q) => q.id)).toEqual(['q2', 'q1']);
    expect(report.questions[1].missedBy).toEqual([{ nickname: 'Ada', answer: 'No answer' }]);
  });
});

describe('sessionReportToCsv', () => {
  it('escapes commas in prompts', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '111111',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
      },
      quizTitle: 'Geo',
      teamMode: false,
      players: [{ id: 'p1', nickname: 'Ada, A.', score: 10, streak: 0 }],
      questions: [{ ...capital, prompt: 'Capital, France?' }],
      answers: [],
    });
    const csv = sessionReportToCsv(report);
    expect(csv).toContain('"Ada, A."');
    expect(csv).toContain('"1. Capital, France?"');
  });
});

describe('compareSessionReports', () => {
  it('flags questions that got easier or stayed hard', () => {
    const base = {
      quizTitle: 'Geo',
      teamMode: false,
      players: [
        { id: 'p1', nickname: 'Ada', score: 1000, streak: 1 },
        { id: 'p2', nickname: 'Bob', score: 0, streak: 0 },
      ],
      questions: [capital],
    };
    const previous = buildSessionReport({
      ...base,
      session: {
        id: 'old',
        pin: '111111',
        status: 'finished',
        created_at: '2026-08-01T12:00:00.000Z',
        quiz_id: 'quiz-1',
      },
      answers: [
        {
          player_id: 'p1',
          question_id: 'q1',
          selected_answer_ids: ['b'],
          points_awarded: 0,
          is_correct: false,
          time_taken_ms: 1000,
        },
        {
          player_id: 'p2',
          question_id: 'q1',
          selected_answer_ids: ['b'],
          points_awarded: 0,
          is_correct: false,
          time_taken_ms: 1000,
        },
      ],
    });
    const current = buildSessionReport({
      ...base,
      session: {
        id: 'new',
        pin: '222222',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
      },
      answers: [
        {
          player_id: 'p1',
          question_id: 'q1',
          selected_answer_ids: ['a'],
          points_awarded: 1000,
          is_correct: true,
          time_taken_ms: 800,
        },
        {
          player_id: 'p2',
          question_id: 'q1',
          selected_answer_ids: ['a'],
          points_awarded: 1000,
          is_correct: true,
          time_taken_ms: 900,
        },
      ],
    });
    const compare = compareSessionReports(current, previous);
    expect(compare.avgDelta).toBe(100);
    expect(compare.improved[0]).toMatchObject({ id: 'q1', before: 0, after: 100, delta: 100 });
    expect(compare.stillHard).toEqual([]);
  });
});
