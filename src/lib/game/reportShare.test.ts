import { describe, expect, it } from 'vitest';
import { buildSessionReport } from '@/lib/game/sessionReport';
import { reportShareInputFrom, reportShareText, reportWhatsAppHref } from '@/lib/game/reportShare';

const SESSION = '2f1c9a10-4b3e-4a11-9c22-8f7e6d5c4b3a';

const report = buildSessionReport({
  session: {
    id: SESSION,
    pin: '847291',
    status: 'finished',
    created_at: '2026-08-18T12:00:00.000Z',
    quiz_id: 'quiz-1',
    question_order: ['q1'],
  },
  quizTitle: 'Geo',
  teamMode: false,
  players: [
    { id: 'p1', nickname: 'Ada', score: 1800, streak: 2 },
    { id: 'p2', nickname: 'Bob', score: 0, streak: 0 },
  ],
  questions: [
    {
      id: 'q1',
      prompt: 'Capital?',
      type: 'mcq',
      order_index: 0,
      answers: [
        { id: 'a', text: 'Paris', color: '#e11d2e', shape: 'slash', is_correct: true },
        { id: 'b', text: 'Lyon', color: '#4a2aff', shape: 'qring', is_correct: false },
      ],
    },
  ],
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
  ],
});

describe('reportShare', () => {
  it('summarizes the class without per-student misses', () => {
    const input = reportShareInputFrom(report);
    expect(input.top[0]).toEqual({ nickname: 'Ada', score: 1800 });
    expect(input.hardCount).toBe(1);
    const text = reportShareText('en', input, `https://qlash.test/p/${SESSION}`);
    expect(text).toContain('PIN 847291');
    expect(text).toContain('1. Ada — 1800');
    expect(text).toContain('1 still hard');
    expect(text).not.toContain('Lyon');
    expect(text).not.toContain('Capital?');
    expect(reportShareText('ar', input, `https://qlash.test/p/${SESSION}`)).toContain('تقرير قلاش');
    expect(decodeURIComponent(reportWhatsAppHref('https://qlash.test', 'en', report))).toContain(`/p/${SESSION}`);
  });
});
