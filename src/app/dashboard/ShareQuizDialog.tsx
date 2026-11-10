'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { enableQuizShare, rotateQuizShare, stopQuizShare } from '@/lib/host/hostApi';
import { useLocale } from '@/lib/i18n/useLocale';

export interface ShareQuizTarget {
  id: string;
  title: string;
  share_code?: string | null;
}

function shareUrl(code: string): string {
  if (typeof window === 'undefined') return `/q/${code}`;
  return `${window.location.origin}/q/${code}`;
}

export function ShareQuizDialog({
  quiz,
  open,
  onOpenChange,
  onShareCode,
}: {
  quiz: ShareQuizTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShareCode: (quizId: string, shareCode: string | null) => void;
}) {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const code = quiz?.share_code || null;

  const copy = async (nextCode: string, message: string) => {
    await navigator.clipboard.writeText(shareUrl(nextCode));
    toast.success(message);
  };

  const create = async () => {
    if (!quiz || pending) return;
    setPending(true);
    try {
      const { shareCode } = await enableQuizShare(quiz.id);
      onShareCode(quiz.id, shareCode);
      await copy(shareCode, t('linkCopied'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('shareQuiz'));
    } finally {
      setPending(false);
    }
  };

  const replace = async () => {
    if (!quiz || pending) return;
    setPending(true);
    try {
      const { shareCode } = await rotateQuizShare(quiz.id);
      onShareCode(quiz.id, shareCode);
      await copy(shareCode, t('shareLinkUpdated'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('shareQuiz'));
    } finally {
      setPending(false);
    }
  };

  const stop = async () => {
    if (!quiz || pending) return;
    setPending(true);
    try {
      await stopQuizShare(quiz.id);
      onShareCode(quiz.id, null);
      toast.success(t('sharingStopped'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('shareQuiz'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none border-2 border-arena-ink bg-white text-arena-ink">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{t('shareQuiz')}</DialogTitle>
          <DialogDescription className="text-arena-ink/70">{t('shareAnswersWarning')}</DialogDescription>
        </DialogHeader>
        {quiz && code ? (
          <p dir="ltr" className="mt-4 break-all text-sm font-semibold">
            {shareUrl(code)}
          </p>
        ) : null}
        <DialogFooter className="mt-5 gap-2">
          {quiz && code ? (
            <>
              <Button type="button" disabled={pending} onClick={() => void copy(code, t('linkCopied'))}>
                {t('copyLink')}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => void replace()}>
                {t('newShareLink')}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => void stop()}>
                {t('stopSharing')}
              </Button>
            </>
          ) : (
            <Button type="button" disabled={pending || !quiz} onClick={() => void create()}>
              {t('createShareLink')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
