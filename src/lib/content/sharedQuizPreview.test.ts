import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();

describe('sharedQuizPreview', () => {
  beforeEach(() => {
    admin.reset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('returns null for a short or unknown code', async () => {
    const { getSharedQuizPreview } = await import('@/lib/content/sharedQuizPreview');
    expect(await getSharedQuizPreview('ab')).toBeNull();
    admin.setTable('quizzes', { data: null, error: null });
    expect(await getSharedQuizPreview('ABCDEFGH')).toBeNull();
  });

  it('returns safe public fields and a question count', async () => {
    admin.setTables({
      quizzes: {
        data: { id: 'q1', title: 'Advent', description: 'Week 1', team_mode: true },
        error: null,
      },
      questions: { data: [{ id: '1' }, { id: '2' }, { id: '3' }], error: null },
    });
    const { getSharedQuizPreview, quizPreviewPath, quizShareText, quizWhatsAppHref } = await import(
      '@/lib/content/sharedQuizPreview'
    );
    expect(await getSharedQuizPreview(' advent-1 ')).toEqual({
      title: 'Advent',
      description: 'Week 1',
      questionCount: 3,
      teamMode: true,
      shareCode: 'ADVENT1',
    });
    expect(quizPreviewPath('advent-1')).toBe('/q/ADVENT1');
    expect(quizShareText('en', 'Advent', 3, 'https://qlash.test/q/ADVENT1')).toContain('3 questions');
    expect(quizShareText('ar', 'Advent', 3, 'https://qlash.test/q/ADVENT1')).toContain('3 أسئلة');
    expect(decodeURIComponent(quizWhatsAppHref('https://qlash.test', 'ADVENT1', 'en', 'Advent', 3))).toContain(
      '/q/ADVENT1'
    );
  });
});
