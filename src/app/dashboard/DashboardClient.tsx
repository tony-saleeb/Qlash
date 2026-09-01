'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
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
  createPackQuiz,
  enableQuizShare,
  createGameSession,
  setHostLocale,
} from '@/lib/host/hostApi';
import { Plus, Play, Edit, Copy, Trash2, LogOut, BookTemplate, ClipboardList, Link2 } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { livePlayerCap, normalizeHostPlan, quizLibraryCap } from '@/lib/game/constants';
import { LocaleToggle } from '@/components/brand/LocaleToggle';
import { useLocale } from '@/lib/i18n/useLocale';
import { CONTENT_PACKS } from '@/lib/content/packs';
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
  user: User;
  hostPlan?: string | null;
  initialLocale?: Locale;
}

function quizTitleFromSession(session: RecentSession): string {
  const quiz = Array.isArray(session.quizzes) ? session.quizzes[0] : session.quizzes;
  return quiz?.title || 'Untitled quiz';
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
  const [packsOpen, setPacksOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const plan = normalizeHostPlan(hostPlan);
  const quizCap = quizLibraryCap(plan);
  const playerCap = livePlayerCap(plan);
  const atQuizCap = Number.isFinite(quizCap) && quizzes.length >= quizCap;
  const planLabel = plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Org';
  const quizQuotaLabel = Number.isFinite(quizCap)
    ? `${quizzes.length}/${quizCap} quizzes`
    : `${quizzes.length} quizzes`;

  const toastQuizCap = () => {
    toast.error(`Free plan is ${quizCap} quizzes. Delete one, or ask for Pro.`);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out.');
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Failed to sign out.');
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Quiz title is required.');
      return;
    }
    setActionLoading(true);
    try {
      const newQuiz = await createQuiz(title.trim(), description.trim());
      toast.success('Quiz created.');
      setQuizzes([newQuiz, ...quizzes]);
      setCreateDialogOpen(false);
      setTitle('');
      setDescription('');
      router.push(`/dashboard/quizzes/${newQuiz.id}/edit`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create quiz.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePack = async (packId: string) => {
    if (atQuizCap) {
      toastQuizCap();
      return;
    }
    const loadingToast = toast.loading('Adding pack…');
    try {
      const newQuiz = await createPackQuiz(packId);
      const pack = CONTENT_PACKS.find((item) => item.id === packId);
      toast.success('Pack added to your library.', { id: loadingToast });
      setQuizzes([{ ...newQuiz, questions: [{ count: pack?.questions.length ?? 0 }] }, ...quizzes]);
      setPacksOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add pack.', { id: loadingToast });
    }
  };

  const handleShareQuiz = async (quiz: Quiz) => {
    const loadingToast = toast.loading('Preparing share link…');
    try {
      const { shareCode } = await enableQuizShare(quiz.id);
      const url = `${window.location.origin}/q/${shareCode}`;
      await navigator.clipboard.writeText(url);
      setQuizzes((current) =>
        current.map((row) => (row.id === quiz.id ? { ...row, share_code: shareCode } : row))
      );
      toast.success(t('linkCopied'), { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not share this quiz.', { id: loadingToast });
    }
  };

  const handleCloneQuiz = async (quizId: string) => {
    if (atQuizCap) {
      toastQuizCap();
      return;
    }
    const loadingToast = toast.loading('Duplicating…');
    try {
      const cloned = await cloneQuiz(quizId);
      toast.success('Quiz duplicated.', { id: loadingToast });
      setQuizzes([cloned, ...quizzes]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to clone.', { id: loadingToast });
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm('Delete this quiz and all its questions?')) return;
    const loadingToast = toast.loading('Deleting…');
    try {
      await deleteQuiz(quizId);
      toast.success('Deleted.', { id: loadingToast });
      setQuizzes(quizzes.filter((q) => q.id !== quizId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete.', { id: loadingToast });
    }
  };

  const handleHostGame = async (quizId: string) => {
    const loadingToast = toast.loading('Opening live lobby…');
    try {
      const session = await createGameSession(quizId);
      toast.success('Lobby ready.', { id: loadingToast });
      router.push(`/host/${session.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start game.', { id: loadingToast });
    }
  };

  return (
    <div className="arena-noise relative min-h-screen bg-arena-canvas">
      <div className="pointer-events-none absolute inset-0 arena-grid opacity-40" />

      <header className="sticky top-0 z-20 border-b-2 border-arena-ink bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button type="button" onClick={() => router.push('/')}>
            <BrandMark size="sm" />
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-arena-ink/40">
                {planLabel} · {playerCap} live
              </p>
              <p className="max-w-[180px] truncate text-sm font-semibold text-arena-ink">{user.email}</p>
            </div>
            <LocaleToggle locale={locale} onChange={persistLocale} />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-none border-2 border-arena-ink text-arena-ink/60 hover:bg-arena-ink hover:text-white"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="arena-chip mb-3 bg-arena-acid">Your library</p>
            <h1 className="font-display text-5xl font-extrabold tracking-[-0.03em] text-arena-ink">Quizzes</h1>
            <p className="mt-2 max-w-md text-sm font-medium text-arena-ink/55">
              Build once. Host live. Open the class report after the podium.
              {' '}
              <span className="text-arena-ink/80">{quizQuotaLabel}</span>
              {atQuizCap ? ' — delete one to add another.' : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => (atQuizCap ? toastQuizCap() : setPacksOpen(true))}
              disabled={atQuizCap}
              className="h-11 rounded-none border-2 border-arena-ink bg-transparent font-bold text-arena-ink hover:bg-arena-ink hover:text-white"
            >
              <BookTemplate className="mr-1.5 h-4 w-4" /> {t('packs')}
            </Button>
            <Button
              onClick={() => (atQuizCap ? toastQuizCap() : setCreateDialogOpen(true))}
              className="h-11 rounded-none bg-arena-signal font-display font-extrabold text-white hover:bg-arena-signal/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> New quiz
            </Button>
          </div>
        </div>

        {quizzes.length === 0 ? (
          <div className="mx-auto max-w-md border-2 border-dashed border-arena-ink/30 bg-white px-8 py-14 text-center shadow-[8px_8px_0_rgba(10,12,16,0.08)]">
            <h3 className="font-display text-xl font-bold text-arena-ink">No quizzes yet</h3>
            <p className="mt-2 text-sm text-arena-ink/55">Create your first set and open a live lobby.</p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="mt-6 h-11 rounded-none bg-arena-ink font-bold text-white"
            >
              Create quiz
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
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-arena-ink/40">
                      {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                    </p>
                    <h2 dir="auto" className="mt-1 line-clamp-1 font-display text-xl font-extrabold tracking-tight text-arena-ink">
                      {quiz.title}
                    </h2>
                    <p dir="auto" className="mt-1 min-h-[2.5rem] text-sm text-arena-ink/55 line-clamp-2">
                      {quiz.description || 'No description'}
                    </p>
                    <p className="mt-3 text-xs text-arena-ink/35">
                      {new Date(quiz.created_at).toLocaleDateString()}
                    </p>

                    <div className="mt-5 flex items-center gap-2 border-t-2 border-arena-ink/10 pt-4">
                      <Button
                        onClick={() => handleHostGame(quiz.id)}
                        className="h-10 flex-1 rounded-none bg-arena-ink font-display font-extrabold text-white hover:bg-arena-ink/90"
                      >
                        <Play className="mr-1 h-3.5 w-3.5 fill-current" /> Host
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none border-2 border-arena-ink/20"
                        onClick={() => router.push(`/dashboard/quizzes/${quiz.id}/edit`)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none border-2 border-arena-ink/20"
                        onClick={() => handleShareQuiz(quiz)}
                        title={t('shareQuiz')}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none border-2 border-arena-ink/20"
                        onClick={() => handleCloneQuiz(quiz.id)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-none border-2 border-arena-ink/20 text-arena-signal hover:bg-arena-signal/10"
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        title="Delete"
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
            <p className="arena-chip mb-3 w-fit bg-white">Recent rooms</p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Class reports</h2>
            <ul className="mt-5 divide-y-2 divide-arena-ink/10 border-2 border-arena-ink bg-white">
              {recentSessions.map((session) => {
                const playerCount = session.players?.[0]?.count ?? 0;
                return (
                  <li key={session.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p dir="auto" className="font-display text-lg font-bold">{quizTitleFromSession(session)}</p>
                      <p className="text-xs text-arena-ink/45">
                        PIN <bdi>{session.pin}</bdi> · {playerCount} {playerCount === 1 ? 'player' : 'players'} ·{' '}
                        {new Date(session.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="h-10 rounded-none border-2 border-arena-ink font-bold"
                        onClick={() => router.push(`/dashboard/sessions/${session.id}`)}
                      >
                        <ClipboardList className="mr-1.5 h-4 w-4" /> Report
                      </Button>
                      {session.quiz_id && (
                        <Button
                          className="h-10 rounded-none bg-arena-ink font-display font-extrabold text-white hover:bg-arena-ink/90"
                          onClick={() => handleHostGame(session.quiz_id!)}
                        >
                          <Play className="mr-1 h-3.5 w-3.5 fill-current" /> Replay
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

      <Dialog open={packsOpen} onOpenChange={setPacksOpen}>
        <DialogContent className="max-w-lg rounded-none border-2 border-arena-ink bg-white text-arena-ink">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold">{t('packs')}</DialogTitle>
            <DialogDescription className="text-arena-ink/55">
              Add a ready Arabic quiz, then edit it like any other set.
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-4 space-y-3">
            {CONTENT_PACKS.map((pack) => (
              <li key={pack.id}>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleCreatePack(pack.id)}
                  className="flex w-full flex-col items-start border-2 border-arena-ink/15 bg-arena-canvas px-4 py-3 text-left transition hover:border-arena-ink hover:bg-white"
                >
                  <span dir="auto" className="font-display text-lg font-extrabold">{pack.title}</span>
                  <span dir="auto" className="mt-0.5 text-sm text-arena-ink/60">{pack.description}</span>
                  <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-arena-ink/40">
                    {pack.blurbEn} · {pack.questions.length} questions
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-arena-line bg-white text-arena-ink">
          <form onSubmit={handleCreateQuiz}>
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-extrabold">New quiz</DialogTitle>
              <DialogDescription className="text-arena-ink/55">
                Name it now — add questions in the editor next.
              </DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-3">
              <div>
                <Label htmlFor="quizTitle" className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/50">
                  Title
                </Label>
                <Input
                  id="quizTitle"
                  placeholder="World History Trivia"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 h-11 rounded-xl border-2 border-arena-ink/15"
                  maxLength={50}
                  required
                />
              </div>
              <div>
                <Label htmlFor="quizDesc" className="text-[11px] font-bold uppercase tracking-wider text-arena-ink/50">
                  Description
                </Label>
                <Input
                  id="quizDesc"
                  placeholder="Optional"
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-arena-signal font-bold text-white hover:bg-arena-signal/90"
              >
                {actionLoading ? 'Creating…' : 'Create & edit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
