import { recapQuestionIds, type SessionReport } from '@/lib/game/sessionReport';
import { podiumUrl, type PodiumPlace } from '@/lib/game/podiumShare';
import { whatsAppShareUrl } from '@/lib/game/lobbyLink';
import type { Locale } from '@/lib/i18n/locale';

export type ReportShareInput = {
  sessionId: string;
  quizTitle: string;
  pin: string;
  playerCount: number;
  avgAccuracy: number | null;
  hardCount: number;
  top: PodiumPlace[];
};

export function reportShareInputFrom(report: SessionReport): ReportShareInput {
  return {
    sessionId: report.sessionId,
    quizTitle: report.quizTitle,
    pin: report.pin,
    playerCount: report.playerCount,
    avgAccuracy: report.avgAccuracy,
    hardCount: recapQuestionIds(report).length,
    top: report.players.slice(0, 3).map((player) => ({
      nickname: player.nickname,
      score: player.score,
    })),
  };
}

export function reportShareText(locale: Locale, input: ReportShareInput, url: string): string {
  const accuracy =
    input.avgAccuracy === null
      ? locale === 'ar'
        ? 'من غير نسبة'
        : 'no accuracy yet'
      : locale === 'ar'
        ? `${input.avgAccuracy}% دقة الفصل`
        : `${input.avgAccuracy}% class accuracy`;

  const hard =
    input.hardCount > 0
      ? locale === 'ar'
        ? `${input.hardCount} أسئلة لسه صعبة`
        : `${input.hardCount} still hard`
      : null;

  const header =
    locale === 'ar'
      ? `تقرير قلاش: ${input.quizTitle}\nالكود: ${input.pin} · ${input.playerCount} لاعب · ${accuracy}`
      : `Qlash class report: ${input.quizTitle}\nPIN ${input.pin} · ${input.playerCount} players · ${accuracy}`;

  const standings = input.top
    .slice(0, 3)
    .map((place, index) => `${index + 1}. ${place.nickname} — ${place.score}`);

  return [header, ...standings, hard, url].filter(Boolean).join('\n');
}

export function reportWhatsAppHref(origin: string, locale: Locale, report: SessionReport): string {
  const input = reportShareInputFrom(report);
  return whatsAppShareUrl(reportShareText(locale, input, podiumUrl(origin, input.sessionId)));
}
