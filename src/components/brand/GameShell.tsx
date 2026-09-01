import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function GameShell({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'arena-stage arena-noise relative flex min-h-dvh w-full flex-col overflow-x-hidden overflow-y-auto font-sans',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 arena-grid opacity-[0.18]" />
      <div className="pointer-events-none absolute -right-12 top-20 h-28 w-28 rotate-[14deg] bg-arena-acid/75" />
      <div className="pointer-events-none absolute bottom-24 -left-5 h-16 w-16 -rotate-6 bg-arena-signal" />
      <div className="pointer-events-none absolute bottom-12 left-16 h-8 w-32 bg-arena-court/80" />
      <div className={cn('relative z-10 flex min-h-dvh flex-1 flex-col', padded && 'p-5 sm:p-6')}>
        {children}
      </div>
    </div>
  );
}

export function LiveChip({
  children,
  tone = 'signal',
  className,
}: {
  children: ReactNode;
  tone?: 'signal' | 'acid' | 'court' | 'ink';
  className?: string;
}) {
  const tones = {
    signal: 'border-arena-signal bg-arena-signal text-white',
    acid: 'border-arena-acid bg-arena-acid text-arena-ink',
    court: 'border-arena-court bg-arena-court text-white',
    ink: 'border-white/30 bg-white/10 text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex h-10 items-center border-2 px-4 font-display text-[11px] font-extrabold uppercase tracking-[0.14em]',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatBox({
  value,
  label,
  tone = 'acid',
  pulse,
}: {
  value: ReactNode;
  label: string;
  tone?: 'acid' | 'signal' | 'court';
  pulse?: boolean;
}) {
  const border =
    tone === 'signal' ? 'border-arena-signal' : tone === 'court' ? 'border-arena-court' : 'border-arena-acid';
  const valueColor =
    tone === 'signal' ? 'text-arena-signal' : tone === 'court' ? 'text-white' : 'text-white';

  return (
    <div
      className={cn(
        'flex h-24 w-24 flex-col items-center justify-center border-4 bg-black/40 shadow-[6px_6px_0_rgba(0,0,0,0.35)] sm:h-32 sm:w-32',
        border,
        pulse && 'animate-pulse'
      )}
    >
      <span className={cn('font-display text-3xl font-extrabold tabular-nums sm:text-4xl', valueColor)}>{value}</span>
      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">{label}</span>
    </div>
  );
}
