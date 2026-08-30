import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeShareCode } from '@/lib/content/shareCode';
import { whatsAppShareUrl } from '@/lib/game/lobbyLink';
import type { Locale } from '@/lib/i18n/locale';

export type SharedQuizPreview = {
  title: string;
  description: string | null;
  questionCount: number;
  teamMode: boolean;
  shareCode: string;
};

export function quizPreviewPath(code: string): string {
  return `/q/${normalizeShareCode(code)}`;
}

export function quizPreviewUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}${quizPreviewPath(code)}`;
}

export function quizShareText(
  locale: Locale,
  title: string,
  questionCount: number,
  url: string
): string {
  if (locale === 'ar') {
    return `اختبار على قلاش: ${title}\n${questionCount} أسئلة\n${url}`;
  }
  return `A Qlash quiz to import: ${title}\n${questionCount} questions\n${url}`;
}

export function quizWhatsAppHref(
  origin: string,
  code: string,
  locale: Locale,
  title: string,
  questionCount: number
): string {
  return whatsAppShareUrl(quizShareText(locale, title, questionCount, quizPreviewUrl(origin, code)));
}

export async function getSharedQuizPreview(rawCode: string): Promise<SharedQuizPreview | null> {
  const shareCode = normalizeShareCode(rawCode);
  if (shareCode.length < 6) return null;

  const admin = createAdminClient();
  const { data: quiz, error } = await admin
    .from('quizzes')
    .select('id, title, description, team_mode')
    .eq('share_code', shareCode)
    .maybeSingle();

  if (error || !quiz) return null;

  const { data: questions } = await admin.from('questions').select('id').eq('quiz_id', quiz.id);

  return {
    title: typeof quiz.title === 'string' && quiz.title.trim() ? quiz.title : 'Qlash quiz',
    description: typeof quiz.description === 'string' ? quiz.description : null,
    questionCount: Array.isArray(questions) ? questions.length : 0,
    teamMode: Boolean(quiz.team_mode),
    shareCode,
  };
}
