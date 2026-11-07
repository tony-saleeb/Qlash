import { describe, expect, it } from 'vitest';
import { buildSessionReport, compareSessionReports, recapQuestionIds, sessionReportToCsv } from '@/lib/game/sessionReport';

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

  it('starts with a UTF-8 BOM so Excel keeps Arabic', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '111111',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
      },
      quizTitle: 'جغرافيا',
      teamMode: false,
      players: [{ id: 'p1', nickname: 'أحمد', score: 10, streak: 0 }],
      questions: [{ ...capital, prompt: 'ما عاصمة فرنسا؟' }],
      answers: [],
    });
    const csv = sessionReportToCsv(report);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('أحمد');
    expect(csv).toContain('ما عاصمة فرنسا؟');
  });

  it('keeps formula-like nicknames as text', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '111111',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
      },
      quizTitle: 'Geo',
      teamMode: true,
      players: [
        { id: 'p1', nickname: '=HYPERLINK("http://evil")', team_name: '@red', score: 10, streak: 0 },
        { id: 'p2', nickname: '+Ada', team_name: '-blue', score: 0, streak: 0 },
        { id: 'p3', nickname: '\tAda', team_name: '\rblue', score: 0, streak: 0 },
      ],
      questions: [{ ...capital, prompt: 'Line\rbreak' }],
      answers: [],
    });
    const csv = sessionReportToCsv(report);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain("'@red");
    expect(csv).toContain("'+Ada");
    expect(csv).toContain("'-blue");
    expect(csv).toContain("'\tAda");
    expect(csv).toContain('"\'\rblue"');
    expect(csv).toContain('"1. Line\rbreak"');
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

const river = {
  id: 'q3',
  prompt: 'Longest river?',
  type: 'mcq',
  order_index: 2,
  answers: [
    { id: 'nile', text: 'Nile', color: '#e11d2e', shape: 'slash', is_correct: true },
    { id: 'seine', text: 'Seine', color: '#4a2aff', shape: 'qring', is_correct: false },
  ],
};

describe('played questions', () => {
  const ten = [capital, poll, river];

  it('stops at the questions the room actually reached', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '847291',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
        question_order: ['q1', 'q2', 'q3'],
        current_question_index: 0,
        scored_question_ids: ['q1'],
      },
      quizTitle: 'Geo',
      teamMode: false,
      players: [{ id: 'p1', nickname: 'Ada', score: 0, streak: 0, joined_at: '2026-08-18T12:00:00.000Z' }],
      questions: ten,
      answers: [
        {
          player_id: 'p1',
          question_id: 'q1',
          selected_answer_ids: ['b'],
          points_awarded: 0,
          is_correct: false,
          time_taken_ms: 1000,
          answered_at: '2026-08-18T12:01:00.000Z',
        },
      ],
    });
    expect(report.questions.map((q) => q.id)).toEqual(['q1']);
    expect(report.questionCount).toBe(1);
    expect(recapQuestionIds(report)).toEqual(['q1']);
    expect(report.questions.some((q) => q.id === 'q3')).toBe(false);
  });

  it('leaves out a question the host jumped over', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '847291',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
        question_order: ['q1', 'q2', 'q3'],
        current_question_index: 2,
        scored_question_ids: ['q1', 'q3'],
      },
      quizTitle: 'Geo',
      teamMode: false,
      players: [{ id: 'p1', nickname: 'Ada', score: 0, streak: 0 }],
      questions: ten,
      answers: [],
    });
    expect(report.questions.map((q) => q.id)).toEqual(['q1', 'q3']);
  });

  it('does not count a late joiner as missing questions asked before they arrived', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '847291',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
        question_order: ['q1', 'q3'],
        current_question_index: 1,
        scored_question_ids: ['q1', 'q3'],
      },
      quizTitle: 'Geo',
      teamMode: false,
      players: [
        { id: 'p1', nickname: 'Ada', score: 1000, streak: 1, joined_at: '2026-08-18T12:00:00.000Z' },
        { id: 'p2', nickname: 'Late', score: 1000, streak: 1, joined_at: '2026-08-18T12:05:00.000Z' },
      ],
      questions: [capital, river],
      answers: [
        {
          player_id: 'p1',
          question_id: 'q1',
          selected_answer_ids: ['a'],
          points_awarded: 1000,
          is_correct: true,
          time_taken_ms: 1000,
          answered_at: '2026-08-18T12:01:00.000Z',
        },
        {
          player_id: 'p1',
          question_id: 'q3',
          selected_answer_ids: ['seine'],
          points_awarded: 0,
          is_correct: false,
          time_taken_ms: 1000,
          answered_at: '2026-08-18T12:06:00.000Z',
        },
        {
          player_id: 'p2',
          question_id: 'q3',
          selected_answer_ids: ['nile'],
          points_awarded: 1000,
          is_correct: true,
          time_taken_ms: 800,
          answered_at: '2026-08-18T12:06:10.000Z',
        },
      ],
    });
    expect(report.questions[0].accuracy).toBe(100);
    expect(report.questions[0].missedBy).toEqual([]);
    expect(report.questions[1].accuracy).toBe(50);
    expect(report.players.find((p) => p.nickname === 'Late')).toMatchObject({
      correct: 1,
      asked: 1,
      accuracy: 100,
    });
    expect(report.players.find((p) => p.nickname === 'Ada')).toMatchObject({
      correct: 1,
      asked: 2,
      accuracy: 50,
    });
  });
});

describe('recapQuestionIds', () => {
  it('keeps scored questions the class missed', () => {
    const report = buildSessionReport({
      session: {
        id: 's1',
        pin: '847291',
        status: 'finished',
        created_at: '2026-08-18T12:00:00.000Z',
        quiz_id: 'quiz-1',
      },
      quizTitle: 'Geo',
      teamMode: false,
      players: [
        { id: 'p1', nickname: 'Ada', score: 0, streak: 0 },
        { id: 'p2', nickname: 'Bob', score: 0, streak: 0 },
      ],
      questions: [capital],
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
    expect(recapQuestionIds(report)).toEqual(['q1']);
  });
});
