import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';
import { podiumPath, podiumShareText, podiumWhatsAppHref } from '@/lib/game/podiumShare';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const admin = createClientMock();
const SESSION = '2f1c9a10-4b3e-4a11-9c22-8f7e6d5c4b3a';

describe('podiumShare', () => {
  beforeEach(() => {
    admin.reset();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('builds a podium WhatsApp card with ranks and a public URL', () => {
    const top = [
      { nickname: 'Ada', score: 1840 },
      { nickname: 'Bob', score: 900 },
    ];
    expect(podiumPath(SESSION)).toBe(`/p/${SESSION}`);
    expect(podiumShareText('en', 'Geo', top, `https://qlash.test/p/${SESSION}`)).toContain('1. Ada — 1840');
    expect(podiumShareText('ar', 'Geo', top, `https://qlash.test/p/${SESSION}`)).toContain('منصة قلاش');
    expect(decodeURIComponent(podiumWhatsAppHref('https://qlash.test', SESSION, 'en', 'Geo', top))).toContain(
      `/p/${SESSION}`
    );
  });

  it('hides unfinished rooms and junk ids', async () => {
    const { getFinishedPodium } = await import('@/lib/game/podiumShare');
    expect(await getFinishedPodium('not-a-uuid')).toBeNull();
    admin.setTable('game_sessions', { data: { id: SESSION, status: 'lobby', quizzes: { title: 'Geo' } }, error: null });
    expect(await getFinishedPodium(SESSION)).toBeNull();
  });

  it('returns top three of a finished room', async () => {
    admin.setTables({
      game_sessions: {
        data: { id: SESSION, status: 'finished', quizzes: { title: 'Geo' } },
        error: null,
      },
      players: {
        data: [
          { nickname: 'Ada', score: 1840 },
          { nickname: 'Bob', score: 900 },
        ],
        error: null,
      },
    });
    const { getFinishedPodium } = await import('@/lib/game/podiumShare');
    expect(await getFinishedPodium(SESSION)).toEqual({
      sessionId: SESSION,
      quizTitle: 'Geo',
      top: [
        { nickname: 'Ada', score: 1840 },
        { nickname: 'Bob', score: 900 },
      ],
    });
  });
});
