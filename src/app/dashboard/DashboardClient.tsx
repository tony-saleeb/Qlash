'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  createQuiz,
  deleteQuiz,
  cloneQuiz,
  setHostLocale,
  type DrawnQuiz,
} from '@/lib/host/hostApi';
import { ShareQuizDialog } from '@/app/dashboard/ShareQuizDialog';
import { QuestionBankDialog } from '@/app/dashboard/QuestionBankDialog';
import { Plus, Play, Edit, Copy, Trash2, LogOut, Library, ClipboardList, Link2, Loader2 } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { livePlayerCap, normalizeHostPlan, quizLibraryCap } from '@/lib/game/constants';
import { LocaleToggle } from '@/components/brand/LocaleToggle';
import { useLocale } from '@/lib/i18n/useLocale';
import { fill } from '@/lib/i18n/messages';
import { formatHostDate } from '@/lib/i18n/format';
import { claimInFlight, releaseInFlight } from '@/lib/ui/inFlight';
import type { Locale } from '@/lib/i18n/locale';

interface Quiz {
  id: string;
  title: string;
  description: string;
  created_at: string;
  share_code?: string | null;
  questions?: { count: number }[];
}

export interface RecentSession {
  id: string;
  pin: string;
  created_at: string;
  quiz_id: string | null;
  quizzes: { title: string } | { title: string }[] | null;
  players?: { count: number }[];
}

interface DashboardClientProps {
  initialQuizzes: Quiz[];
  recentSessions: RecentSession[];
  user: { email: string | null };
  hostPlan?: string | null;
  initialLocale?: Locale;
}

function quizTitleFromSession(session: RecentSession, untitled: string): string {
  const quiz = Array.isArray(session.quizzes) ? session.quizzes[0] : session.quizzes;
  return quiz?.title || untitled;
}

export default function DashboardClient({
  initialQuizzes,
  recentSessions = [],
  user,
  hostPlan,
  initialLocale,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { locale, setLocale, t } = useLocale(initialLocale);
  const persistLocale = (next: Locale) => {
    setLocale(next);
    void setHostLocale(next);
  };
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [hostingQuizId, setHostingQuizId] = useState<string | null>(null);
  const [shareQuizId, setShareQuizId] = useState<string | null>(null);
  const [clonePending, setClonePending] = useState(false);
  const cloneFlight = useRef(false);

  const plan = normalizeHostPlan(hostPlan);
  const quizCap = quizLibraryCap(plan);
  const playerCap = livePlayerCap(plan);
  const atQuizCap = Number.isFinite(quizCap) && quizzes.length >= quizCap;
  const planLabel = plan === 'free' ? t('planFree') : plan === 'pro' ? t('planPro') : t('planOrg');
  const quizQuotaLabel = Number.isFinite(quizCap)
    ? fill(t('quizQuota'), { count: quizzes.length, cap: quizCap })
    : fill(t('quizCount'), { count: quizzes.length });

  const toastQuizCap = () => {
    toast.error(fill(t('freePlanCap'), { cap: quizCap }));
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success(t('signedOutToast'));
      router.push('/');
      router.refresh();
    } catch {
      toast.error(t('failedSignOut'));
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t('quizTitleRequired'));
      return;
    }
    setActionLoading(true);
    try {
      const newQuiz = await createQuiz(title.trim(), description.trim());
      toast.success(t('quizCreated'));
      setQuizzes([newQuiz, ...quizzes]);
      setCreateDialogOpen(false);
      setTitle('');
      setDescription('');
      router.push(`/dashboard/quizzes/${newQuiz.id}/edit`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('failedCreateQuiz'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuizFromBank = (quiz: DrawnQuiz) => {
    setQuizzes((current) => [
      {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        created_at: quiz.created_at,
        questions: [{ count: quiz.questionCount }],
      },
      ...current,
    ]);
  };

  const shareQuiz = quizzes.find((quiz) => quiz.id === shareQuizId) ?? null;

  const handleCloneQuiz = async (quizId: string) => {
    if (atQuizCap) {
      toastQuizCap();
      return;
    }
    if (!claimInFlight(cloneFlight)) return;
    setClonePending(true);
    const loadingToast = toast.loading(t('duplicating'));
    try {
      const cloned = await cloneQuiz(quizId);
      toast.success(t('quizDuplicated'), { id: loadingToast });
      setQuizzes([cloned, ...quizzes]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('failedClone'), { id: loadingToast });
    } finally {
      releaseInFlight(cloneFlight);
      setClonePending(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm(t('deleteQuizConfirm'))) return;
    const loadingToast = toast.loading(t('deleting'));
    try {
      await deleteQuiz(quizId);
      toast.success(t('deleted'), { id: loadingToast });
      setQuizzes(quizzes.filter((q) => q.id !== quizId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('failedDelete'), { id: loadingToast });
    }
  };

  const handleHostGame = (quizId: string) => {
    if (hostingQuizId) return;
    setHostingQuizId(quizId);
    router.push(`/host/open/${quizId}`);
  };

  return (
    <div className="arena-noise relative min-h-dvh bg-arena-canvas">
      <div className="pointer-events-none absolute inset-0 arena-grid opacity-40" />

      <header className="sticky top-0 z-20 border-b-2 border-arena-ink bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <button type="button" onClick={() => router.push('/')}>
            <BrandMark size="sm" />
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden text-end sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-arena-ink/60">
                {planLabel} · {fill(t('liveSeats'), { count: playerCap })}
              </p>
              <p className="max-w-[180px] truncate text-sm font-semibold text-arena-ink">{user.email}</p>
            </div>
            <LocaleToggle locale={locale} onChange={persistLocale} />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-none border-2 border-arena-ink text-arena-ink/60 hover:bg-arena-ink hover:text-white"
              onClick={handleLogout}
              title={t('signOut')}
              aria-label={t('signOut')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="arena-chip mb-3 bg-arena-acid">{t('yourLibrary')}</p>
            <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-arena-ink sm:text-5xl">{t('quizzesHeading')}</h1>
            <p className="mt-2 max-w-md text-sm font-medium text-arena-ink/55">
              {t('libraryHint')}
              {' '}
              <span className="text-arena-ink/80">{quizQuotaLabel}</span>
              {atQuizCap ? ` — ${t('deleteOneToAdd')}` : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setBankOpen(true)}
              className="h-11 rounded-none border-2 border-arena-ink bg-transparent font-bold text-arena-ink hover:bg-arena-ink hover:text-white"
            >
              <Library className="me-1.5 h-4 w-4" /> {t('questionBank')}
            </Button>
            <Button
              onClick={() => (atQuizCap ? toastQuizCap() : setCreateDialogOpen(true))}
              className="h-11 rounded-none bg-arena-signal font-display font-extrabold text-white hover:bg-arena-signal/90"
            >
              <Plus className="me-1.5 h-4 w-4" /> {t('newQuiz')}
            </Button>
          </div>
        </div>

        {quizzes.length === 0 ? (
          <div className="mx-auto max-w-md border-2 border-dashed border-arena-ink/30 bg-white px-8 py-14 text-center shadow-[8px_8px_0_rgba(10,12,16,0.08)]">
            <h3 className="font-display text-xl font-bold text-arena-ink">{t('noQuizzesYet')}</h3>
            <p className="mt-2 text-sm text-arena-ink/55">{t('createFirstSet')}</p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="mt-6 h-11 rounded-none bg-arena-ink font-bold text-white"
            >
              {t('createQuiz')}
            </Button>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz, index) => {
              const questionCount = quiz.questions?.[0]?.count ?? 0;
              const stripe = ['bg-arena-signal', 'bg-arena-court', 'bg-arena-acid', 'bg-arena-ink'][index % 4];

              return (
                <li
                  key={quiz.id}
                  className="arena-panel flex flex-col overflow-hidden transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[10px_10px_0_rgba(10,12,16,0.14)]"
                >
                  <div className={`h-2.5 w-full ${stripe}`} />
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-arena-ink/60">
                      {questionCount} {questionCount === 1 ? t('questionOne') : t('questionMany')}
                    </p>
                    <h2 dir="auto" className="mt-1 line-clamp-1 font-display text-xl font-extrabold tracking-tight text-arena-ink">
                      {quiz.title}
                    </h2>
                    <p dir="auto" className="mt-1 min-h-[2.5rem] text-sm text-arena-ink/55 line-clamp-2">
                      {quiz.description || t('noDescription')}
                    </p>
                    <p className="mt-3 text-xs text-arena-ink/60">
                      {formatHostDate(locale, quiz.created_at)}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t-2 border-arena-ink/10 pt-4">
                      <Button
                        onClick={() => handleHostGame(quiz.id)}
                        disabled={Boolean(hostingQuizId)}
                        className="h-10 min-w-[5.5rem] flex-1 rounded-none bg-arena-ink font-display font-extrabold text-white hover:bg-arena-ink/90"
                      >
                        {hostingQuizId === quiz.id ? (
                          <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="me-1 h-3.5 w-3.5 fill-current" />
                        )}
                        {t('hostThis')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none border-2 border-arena-ink/20"
                        onClick={() => router.push(`/dashboard/quizzes/${quiz.id}/edit`)}
                        title={t('editQuiz')}
                        aria-label={t('editQuiz')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none border-2 border-arena-ink/20"
                        onClick={() => setShareQuizId(quiz.id)}
                        title={t('shareQuiz')}
                        aria-label={t('shareQuiz')}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none border-2 border-arena-ink/20"
                        onClick={() => handleCloneQuiz(quiz.id)}
                        disabled={clonePending}
                        title={t('duplicateQuiz')}
                        aria-label={t('duplicateQuiz')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none border-2 border-arena-ink/20 text-arena-signal hover:bg-arena-signal/10"
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        title={t('deleteQuizLabel')}
                        aria-label={t('deleteQuizLabel')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {recentSessions.length > 0 && (
          <section className="mt-14">
            <p className="arena-chip mb-3 w-fit bg-white">{t('recentRooms')}</p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">{t('classReportsHeading')}</h2>
            <ul className="mt-5 divide-y-2 divide-arena-ink/10 border-2 border-arena-ink bg-white">
              {recentSessions.map((session) => {
                const playerCount = session.players?.[0]?.count ?? 0;
                return (
                  <li key={session.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p dir="auto" className="font-display text-lg font-bold">{quizTitleFromSession(session, t('untitledQuiz'))}</p>
                      <p className="text-xs text-arena-ink/60">
                        {t('pinWord')} <bdi>{session.pin}</bdi> · {playerCount} {playerCount === 1 ? t('playerOne') : t('players')} ·{' '}
                        {formatHostDate(locale, session.created_at, true)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="h-10 rounded-none border-2 border-arena-ink font-bold"
                        onClick={() => router.push(`/dashboard/sessions/${session.id}`)}
                      >
                        <ClipboardList className="me-1.5 h-4 w-4" /> {t('report')}
                      </Button>
                      {session.quiz_id && (
                        <Button
                          className="h-10 rounded-none bg-arena-ink font-display font-extrabold text-white hover:bg-arena-ink/90"
                          disabled={Boolean(hostingQuizId)}
                          onClick={() => handleHostGame(session.quiz_id!)}
                        >
                          {hostingQuizId === session.quiz_id ? (
                            <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="me-1 h-3.5 w-3.5 fill-current" />
                          )}
                          {t('replay')}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      <ShareQuizDialog
        quiz={shareQuiz}
        open={shareQuiz !== null}
        onOpenChange={(next) => {
          if (!next) setShareQuizId(null);
        }}
        onShareCode={(quizId, shareCode) => {
          setQuizzes((current) =>
            current.map((row) => (row.id === quizId ? { ...row, share_code: shareCode } : row))
          );
        }}
      />

      <QuestionBankDialog
        open={bankOpen}
        onOpenChange={setBankOpen}
        atQuizCap={atQuizCap}
        onQuizCap={toastQuizCap}
        onQuizCreated={handleQuizFromBank}
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-arena-line bg-white text-arena-ink">
          <form onSubmit={handleCreateQuiz}>
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-extrabold">{t('newQuiz')}</DialogTitle>
              <DialogDescription className="text-arena-ink/55">
                {t('newQuizHint')}
              </DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-3">
              <div>
                <Label htmlFor="quizTitle" className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/60">
                  {t('titleLabel')}
                </Label>
                <Input
                  id="quizTitle"
                  placeholder={t('titlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 h-11 rounded-xl border-2 border-arena-ink/15"
                  maxLength={50}
                  required
                />
              </div>
              <div>
                <Label htmlFor="quizDesc" className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/60">
                  {t('descriptionLabel')}
                </Label>
                <Input
                  id="quizDesc"
                  placeholder={t('optional')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 h-11 rounded-xl border-2 border-arena-ink/15"
                  maxLength={150}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateDialogOpen(false)}
                className="rounded-xl border border-arena-line"
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-arena-signal font-bold text-white hover:bg-arena-signal/90"
              >
                {actionLoading ? t('creating') : t('createAndEdit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
