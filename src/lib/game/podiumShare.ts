import { createAdminClient } from '@/lib/supabase/admin';
import { whatsAppShareUrl } from '@/lib/game/lobbyLink';
import type { Locale } from '@/lib/i18n/locale';

export type PodiumPlace = {
  nickname: string;
  score: number;
};

export type FinishedPodium = {
  sessionId: string;
  quizTitle: string;
  top: PodiumPlace[];
};

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function podiumPath(sessionId: string): string {
  return `/p/${sessionId}`;
}

export function podiumUrl(origin: string, sessionId: string): string {
  return `${origin.replace(/\/$/, '')}${podiumPath(sessionId)}`;
}

export function podiumShareText(
  locale: Locale,
  quizTitle: string,
  top: PodiumPlace[],
  url: string
): string {
  const lines = top.slice(0, 3).map((place, index) => `${index + 1}. ${place.nickname} — ${place.score}`);
  if (locale === 'ar') {
    return [`منصة قلاش: ${quizTitle}`, ...lines, url].join('\n');
  }
  return [`Qlash podium: ${quizTitle}`, ...lines, url].join('\n');
}

export function podiumWhatsAppHref(
  origin: string,
  sessionId: string,
  locale: Locale,
  quizTitle: string,
  top: PodiumPlace[]
): string {
  return whatsAppShareUrl(podiumShareText(locale, quizTitle, top, podiumUrl(origin, sessionId)));
}

function quizTitleFromJoin(quizzes: unknown): string {
  if (Array.isArray(quizzes)) {
    const title = (quizzes[0] as { title?: unknown } | undefined)?.title;
    return typeof title === 'string' && title.trim() ? title : 'Qlash';
  }
  const title = (quizzes as { title?: unknown } | null)?.title;
  return typeof title === 'string' && title.trim() ? title : 'Qlash';
}

export async function getFinishedPodium(sessionId: string): Promise<FinishedPodium | null> {
  if (!SESSION_ID.test(sessionId)) return null;

  const admin = createAdminClient();
  const { data: session, error } = await admin
    .from('game_sessions')
    .select('id, status, quizzes(title)')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !session || session.status !== 'finished') return null;

  const { data: players } = await admin
    .from('players')
    .select('nickname, score')
    .eq('session_id', session.id)
    .order('score', { ascending: false })
    .limit(3);

  return {
    sessionId: session.id as string,
    quizTitle: quizTitleFromJoin(session.quizzes),
    top: (players ?? []).map((player) => ({
      nickname: typeof player.nickname === 'string' ? player.nickname : 'Player',
      score: Number(player.score) || 0,
    })),
  };
}
