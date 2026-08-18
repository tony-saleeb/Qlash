'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Download, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand/BrandMark';
import { createGameSession } from '@/app/actions/game';
import { sessionReportToCsv, type SessionReport } from '@/lib/game/sessionReport';

export default function SessionReportClient({ report }: { report: SessionReport }) {
  const router = useRouter();

  const downloadCsv = () => {
    const blob = new Blob([sessionReportToCsv(report)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qlash-${report.pin}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const playAgain = async () => {
    if (!report.quizId) {
      toast.error('This quiz is no longer in your library.');
      return;
    }
    const loading = toast.loading('Opening a new lobby…');
    try {
      const session = await createGameSession(report.quizId);
      toast.success('Lobby ready.', { id: loading });
      router.push(`/host/${session.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start a new room.', { id: loading });
    }
  };

  const when = new Date(report.createdAt).toLocaleString();

  return (
    <div className="min-h-screen bg-arena-canvas text-arena-ink">
      <header className="sticky top-0 z-10 border-b-2 border-arena-ink bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-none border-2 border-arena-ink"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <BrandMark size="sm" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="ghost"
              className="h-10 rounded-none border-2 border-arena-ink font-bold"
              onClick={downloadCsv}
            >
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            {report.quizId && (
              <Button
                className="h-10 rounded-none bg-arena-signal font-display font-extrabold text-white hover:bg-arena-signal/90"
                onClick={playAgain}
              >
                <Play className="mr-1.5 h-4 w-4 fill-current" /> Play again
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <p className="arena-chip mb-3 w-fit bg-arena-acid">Class report</p>
          <h1 dir="auto" className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{report.quizTitle}</h1>
          <p className="mt-2 text-sm text-arena-ink/55">
            PIN {report.pin} · {when} · {report.playerCount} players · {report.questionCount} questions
            {report.avgAccuracy !== null ? ` · ${report.avgAccuracy}% class accuracy` : ''}
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Players" value={String(report.playerCount)} />
          <Stat label="Questions" value={String(report.questionCount)} />
          <Stat label="Accuracy" value={report.avgAccuracy === null ? '—' : `${report.avgAccuracy}%`} />
        </section>

        <section className="arena-panel overflow-hidden">
          <h2 className="border-b-2 border-arena-ink bg-arena-ink px-4 py-3 font-display text-sm font-extrabold uppercase tracking-wider text-white">
            Standings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-arena-mist text-[11px] font-bold uppercase tracking-wider text-arena-ink/50">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Player</th>
                  {report.teamMode && <th className="px-4 py-2">Team</th>}
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Correct</th>
                  <th className="px-4 py-2">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {report.players.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-arena-ink/45">
                      No players in this room.
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
                      <td className="px-4 py-2.5 font-mono font-bold">{player.score.toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        {report.scoredQuestionCount === 0
                          ? '—'
                          : `${player.correct}/${report.scoredQuestionCount}`}
                      </td>
                      <td className="px-4 py-2.5">{player.accuracy === null ? '—' : `${player.accuracy}%`}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-extrabold">Who missed what</h2>
          {report.questions.length === 0 ? (
            <p className="text-sm text-arena-ink/50">Question breakdown is unavailable for this room.</p>
          ) : null}
          {report.questions.map((question, index) => (
            <article key={question.id} className="arena-panel p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/40">
                Question {index + 1}
                {question.type === 'poll' ? ' · poll' : question.accuracy !== null ? ` · ${question.accuracy}% correct` : ''}
              </p>
              <h3 dir="auto" className="mt-1 font-display text-lg font-bold">{question.prompt}</h3>
              {question.correctLabels.length > 0 && (
                <p className="mt-2 text-sm text-arena-court">
                  Answer: <span className="font-semibold">{question.correctLabels.join(' · ')}</span>
                </p>
              )}
              {question.type === 'poll' ? (
                <p className="mt-3 text-sm text-arena-ink/50">{question.answered} responses — no right answer.</p>
              ) : question.missedBy.length === 0 ? (
                <p className="mt-3 text-sm text-arena-court">Everyone got this one.</p>
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
      <p className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/40">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}
