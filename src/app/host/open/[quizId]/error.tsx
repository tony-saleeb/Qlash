'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function OpenLobbyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    toast.error(error.message || 'Failed to start game.');
  }, [error.message]);

  return (
    <div className="arena-stage flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <p className="font-display text-2xl font-extrabold">Could not open the lobby</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          className="rounded-none bg-arena-acid font-display font-extrabold text-arena-ink"
          onClick={() => reset()}
        >
          Try again
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-none border-2 border-white/30 text-white"
          onClick={() => router.push('/dashboard')}
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
