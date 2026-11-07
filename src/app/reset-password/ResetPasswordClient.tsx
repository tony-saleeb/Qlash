'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/lib/i18n/useLocale';

export default function ResetPasswordClient() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLocale();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error(t('passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      toast.error(t('passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t('passwordUpdated'));
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('authFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="font-display text-3xl font-extrabold text-arena-ink">{t('newPassword')}</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
        <Input
          type="password"
          dir="ltr"
          autoComplete="new-password"
          placeholder={t('newPassword')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 rounded-none border-2 border-arena-ink/20"
        />
        <Input
          type="password"
          dir="ltr"
          autoComplete="new-password"
          placeholder={t('confirmPassword')}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="h-11 rounded-none border-2 border-arena-ink/20"
        />
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-none bg-arena-court font-display font-extrabold text-white hover:bg-arena-court/90"
        >
          {loading ? t('pleaseWait') : t('savePassword')}
        </Button>
      </form>
    </main>
  );
}
