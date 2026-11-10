'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Download, MessageCircle, Play, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand/BrandMark';
import { LocaleToggle } from '@/components/brand/LocaleToggle';
import { createRecapQuiz, setHostLocale } from '@/lib/host/hostApi';
import { recapQuestionIds } from '@/lib/game/sessionReport';
import { reportWhatsAppHref } from '@/lib/game/reportShare';
import { useLocale } from '@/lib/i18n/useLocale';
import { fill } from '@/lib/i18n/messages';
import { formatHostDate, formatHostNumber } from '@/lib/i18n/format';
import { claimInFlight, releaseInFlight } from '@/lib/ui/inFlight';
import type { Locale } from '@/lib/i18n/locale';
import {
  compareSessionReports,
  sessionReportToCsv,
  type QuestionDelta,
  type SessionReport,
} from '@/lib/game/sessionReport';

function formatDelta(value: number | null): string {
  if (value === null) return '—';
  if (value > 0) return `+${value}`;
  return String(value);
}

export default function SessionReportClient({
  report,
  previous,
}: {
  report: SessionReport;
  previous?: SessionReport | null;
}) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const persistLocale = (next: Locale) => {
    setLocale(next);
    void setHostLocale(next);
  };
  const compare = previous ? compareSessionReports(report, previous) : null;
  const recapCount = recapQuestionIds(report).length;
  const recapFlight = useRef(false);
  const [recapPending, setRecapPending] = useState(false);

  const downloadCsv = () => {
    const blob = new Blob([sessionReportToCsv(report)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qlash-${report.pin}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const playMisses = async () => {
    if (!claimInFlight(recapFlight)) return;
    setRecapPending(true);
    const loading = toast.loading(t('buildingRecap'));
    try {
      const quiz = await createRecapQuiz(report.sessionId);
      toast.success(t('recapReady'), { id: loading });
      router.push(`/host/open/${quiz.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('couldNotBuildRecap'), { id: loading });
    } finally {
      releaseInFlight(recapFlight);
      setRecapPending(false);
    }
  };

  const playAgain = async () => {
    if (!report.quizId) {
      toast.error(t('quizGone'));
      return;
    }
    router.push(`/host/open/${report.quizId}`);
  };

  const when = formatHostDate(locale, report.createdAt, true);
  const previousWhen = compare ? formatHostDate(locale, compare.previousCreatedAt) : '';

  return (
    <div className="min-h-dvh bg-arena-canvas text-arena-ink">
      <header className="sticky top-0 z-10 border-b-2 border-arena-ink bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="no-print rounded-none border-2 border-arena-ink"
              onClick={() => router.push('/dashboard')}
              aria-label={t('backHome')}
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Button>
            <BrandMark size="sm" className="hidden min-[420px]:inline-flex" />
          </div>
          <div className="no-print flex shrink-0 flex-wrap items-center justify-end gap-2">
            <LocaleToggle locale={locale} onChange={persistLocale} />
            <Button
              variant="ghost"
              className="h-10 rounded-none border-2 border-arena-ink font-bold"
              onClick={() =>
                window.open(reportWhatsAppHref(window.location.origin, locale, report), '_blank', 'noopener,noreferrer')
              }
            >
              <MessageCircle className="me-0 h-4 w-4 sm:me-1.5" /> <span className="hidden sm:inline">{t('shareWhatsApp')}</span>
            </Button>
            <Button
              variant="ghost"
              className="h-10 rounded-none border-2 border-arena-ink font-bold"
              onClick={() => window.print()}
            >
              <Printer className="me-0 h-4 w-4 sm:me-1.5" /> <span className="hidden sm:inline">{t('printReport')}</span>
            </Button>
            <Button
              variant="ghost"
              className="h-10 rounded-none border-2 border-arena-ink font-bold"
              onClick={downloadCsv}
            >
              <Download className="me-1.5 h-4 w-4" /> CSV
            </Button>
            {recapCount > 0 && (
              <Button
                variant="ghost"
                className="h-10 rounded-none border-2 border-arena-ink font-bold"
                onClick={playMisses}
                disabled={recapPending}
              >
                <Play className="me-1.5 h-4 w-4 fill-current" /> {t('playMisses')}
              </Button>
            )}
            {report.quizId && (
              <Button
                className="h-10 rounded-none bg-arena-signal font-display font-extrabold text-white hover:bg-arena-signal/90"
                onClick={playAgain}
              >
                <Play className="me-1.5 h-4 w-4 fill-current" /> {t('playAgain')}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <p className="arena-chip mb-3 w-fit bg-arena-acid">{t('classReport')}</p>
          <h1 dir="auto" className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">{report.quizTitle}</h1>
          <p className="mt-2 text-sm text-arena-ink/55">
            {t('pinWord')} {report.pin} · {when} · {report.playerCount} {t('players')} · {report.questionCount} {t('questionMany')}
            {report.avgAccuracy !== null ? ` · ${fill(t('classAccuracy'), { n: report.avgAccuracy })}` : ''}
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label={t('players')} value={String(report.playerCount)} />
          <Stat label={t('questionsHeading')} value={String(report.questionCount)} />
          <Stat label={t('accuracy')} value={report.avgAccuracy === null ? '—' : `${report.avgAccuracy}%`} />
        </section>

        {compare ? (
          <section className="arena-panel overflow-hidden">
            <h2 className="border-b-2 border-arena-ink bg-arena-ink px-4 py-3 font-display text-sm font-extrabold uppercase tracking-wider text-white">
              {t('vsLastClass')}
            </h2>
            <div className="space-y-5 p-5">
              <p className="text-sm text-arena-ink/60">
                {t('pinWord')} {compare.previousPin} · {previousWhen} · {compare.avgBefore ?? '—'}% → {compare.avgAfter ?? '—'}%
                {' '}
                <span className="font-bold text-arena-ink">({formatDelta(compare.avgDelta)})</span>
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <CompareList title={t('stillHard')} rows={compare.stillHard} empty="—" />
                <CompareList title={t('improved')} rows={compare.improved} empty="—" />
              </div>
            </div>
          </section>
        ) : null}

        <section className="arena-panel overflow-hidden">
          <h2 className="border-b-2 border-arena-ink bg-arena-ink px-4 py-3 font-display text-sm font-extrabold uppercase tracking-wider text-white">
            {t('standings')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-start text-sm">
              <thead className="bg-arena-mist text-[11px] font-bold uppercase tracking-wider text-arena-ink/60">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">{t('playerOne')}</th>
                  {report.teamMode && <th className="px-4 py-2">{t('team')}</th>}
                  <th className="px-4 py-2">{t('score')}</th>
                  <th className="px-4 py-2">{t('correct')}</th>
                  <th className="px-4 py-2">{t('accuracy')}</th>
                </tr>
              </thead>
              <tbody>
                {report.players.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-arena-ink/60">
                      {t('noPlayers')}
                    </td>
                  </tr>
                ) : (
                  report.players.map((player, index) => (
                    <tr key={player.id} className="border-t border-arena-line">
                      <td className="px-4 py-2.5 font-display font-bold">{index + 1}</td>
                      <td dir="auto" className="px-4 py-2.5 font-semibold">{player.nickname}</td>
                      {report.teamMode && (
                        <td className="px-4 py-2.5 text-arena-ink/60">{player.teamName || '—'}</td>
                      )}
                      <td className="px-4 py-2.5 font-mono font-bold">{formatHostNumber(locale, player.score)}</td>
                      <td className="px-4 py-2.5">
                        {player.asked === 0 ? '—' : `${player.correct}/${player.asked}`}
                      </td>
                      <td className="px-4 py-2.5">{player.accuracy === null ? '—' : `${player.accuracy}%`}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="no-print space-y-4">
          <h2 className="font-display text-2xl font-extrabold">{t('whoMissed')}</h2>
          {report.questions.length === 0 ? (
            <p className="text-sm text-arena-ink/60">{t('breakdownUnavailable')}</p>
          ) : null}
          {report.questions.map((question, index) => (
            <article key={question.id} className="arena-panel p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/60">
                {fill(t('questionNumber'), { n: index + 1 })}
                {question.type === 'poll' ? ` · ${t('pollTag')}` : question.accuracy !== null ? ` · ${fill(t('percentCorrect'), { n: question.accuracy })}` : ''}
              </p>
              <h3 dir="auto" className="mt-1 font-display text-lg font-bold">{question.prompt}</h3>
              {question.correctLabels.length > 0 && (
                <p className="mt-2 text-sm text-arena-court">
                  {t('answerLabel')}: <span className="font-semibold">{question.correctLabels.join(' · ')}</span>
                </p>
              )}
              {question.type === 'poll' ? (
                <p className="mt-3 text-sm text-arena-ink/60">{fill(t('pollResponses'), { n: question.answered })}</p>
              ) : question.missedBy.length === 0 ? (
                <p className="mt-3 text-sm text-arena-court">{t('everyoneGotThis')}</p>
              ) : (
                <ul className="mt-3 space-y-1 text-sm">
                  {question.missedBy.map((row, i) => (
                    <li key={`${question.id}-${i}`} className="flex justify-between gap-3 border-b border-arena-line/80 py-1.5">
                      <span dir="auto" className="font-semibold">{row.nickname}</span>
                      <span dir="auto" className="truncate text-arena-ink/55">{row.answer}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="arena-panel px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/60">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function CompareList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: QuestionDelta[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-arena-ink/60">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-arena-ink/60">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 border-b border-arena-line/80 py-1.5 text-sm">
              <span dir="auto" className="min-w-0 font-semibold">{row.prompt}</span>
              <span className="shrink-0 font-mono font-bold tabular-nums">
                {row.before ?? '—'}% → {row.after ?? '—'}% ({formatDelta(row.delta)})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
