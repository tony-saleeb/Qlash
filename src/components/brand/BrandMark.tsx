import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const BRAND_NAME = 'Qlash';

/** Square-Q with a clash slash — reads at favicon size and on a projector. */
export function BrandLogo({
  className,
  slashClassName,
}: {
  className?: string;
  slashClassName?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M6 6h16v16H6V6Zm4.25 4.25h7.5v7.5h-7.5v-7.5Z"
      />
      <path
        className={slashClassName}
        d="M16.8 18.4 25.6 27.2l2.8-2.8-8.8-8.8-2.8 2.8Z"
      />
      <path
        className={slashClassName}
        d="M21.2 15.6 29.2 23.6 31 21.8 23 13.8 21.2 15.6Z"
      />
    </svg>
  );
}

export function BrandMark({
  className,
  tone = 'ink',
  size = 'md',
  wordmark = true,
}: {
  className?: string;
  tone?: 'ink' | 'light';
  size?: 'sm' | 'md' | 'lg';
  wordmark?: boolean;
}) {
  const box = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
  const word = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-xl';

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
          box,
          tone === 'light' ? 'bg-arena-acid text-arena-ink' : 'bg-arena-signal text-white'
        )}
        aria-hidden
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent" />
        <BrandLogo
          className="relative h-[70%] w-[70%]"
          slashClassName={tone === 'light' ? 'fill-arena-signal' : 'fill-arena-acid'}
        />
      </span>
      {wordmark && (
        <span
          className={cn(
            'font-display font-extrabold tracking-[-0.04em]',
            word,
            tone === 'light' ? 'text-white' : 'text-arena-ink'
          )}
        >
          {BRAND_NAME}
        </span>
      )}
    </div>
  );
}

export function PinDisplay({
  pin,
  className,
  large,
}: {
  pin: string;
  className?: string;
  large?: boolean;
}) {
  const digits = pin.padEnd(6, '·').slice(0, 6).split('');
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 sm:gap-2',
        className
      )}
      aria-label={`PIN ${pin}`}
    >
      {digits.map((d, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex items-center justify-center border-2 border-arena-ink bg-white font-display font-extrabold tabular-nums text-arena-ink',
            large ? 'h-14 w-11 text-3xl sm:h-16 sm:w-12 sm:text-4xl' : 'h-10 w-8 text-xl',
            i === 3 && 'ml-1.5 sm:ml-2'
          )}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

export function StageBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 bg-arena-acid px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-wider text-arena-ink',
        className
      )}
    >
      {children}
    </span>
  );
}

/** Four classic answer shapes — the product’s visual signature */
export function ArenaFloor({ className }: { className?: string }) {
  return (
    <div className={cn('relative aspect-square w-full max-w-lg', className)} aria-hidden>
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4">
        <div className="arena-shape-tile flex items-center justify-center bg-[#e21b3c] motion-tile-1">
          <svg viewBox="0 0 48 48" className="h-14 w-14 text-white/95 sm:h-20 sm:w-20">
            <polygon points="24,6 44,40 4,40" fill="currentColor" />
          </svg>
        </div>
        <div className="arena-shape-tile flex items-center justify-center bg-[#1368ce] motion-tile-2">
          <svg viewBox="0 0 48 48" className="h-14 w-14 text-white/95 sm:h-20 sm:w-20">
            <polygon points="24,4 44,24 24,44 4,24" fill="currentColor" />
          </svg>
        </div>
        <div className="arena-shape-tile flex items-center justify-center bg-[#d89e00] motion-tile-3">
          <svg viewBox="0 0 48 48" className="h-14 w-14 text-white/95 sm:h-20 sm:w-20">
            <circle cx="24" cy="24" r="16" fill="currentColor" />
          </svg>
        </div>
        <div className="arena-shape-tile flex items-center justify-center bg-[#26890c] motion-tile-4">
          <svg viewBox="0 0 48 48" className="h-14 w-14 text-white/95 sm:h-20 sm:w-20">
            <rect x="8" y="8" width="32" height="32" fill="currentColor" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function AnswerButton({
  color,
  shape,
  label,
  onClick,
  selected,
  className,
}: {
  color: string;
  shape: string;
  label: string;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}) {
  const shapePath: Record<string, ReactNode> = {
    triangle: <polygon points="16,3 30,28 2,28" fill="currentColor" />,
    diamond: <polygon points="16,2 30,16 16,30 2,16" fill="currentColor" />,
    circle: <circle cx="16" cy="16" r="12" fill="currentColor" />,
    square: <rect x="4" y="4" width="24" height="24" fill="currentColor" />,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'arena-answer group relative flex min-h-[7.5rem] flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center text-white transition active:translate-y-1 active:shadow-none',
        selected && 'ring-4 ring-white ring-offset-2 ring-offset-transparent',
        className
      )}
      style={{ backgroundColor: color }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent" />
      <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0 drop-shadow-sm">
        {shapePath[shape] || shapePath.square}
      </svg>
      <span className="line-clamp-3 max-w-full px-1 font-display text-sm font-extrabold leading-snug sm:text-base">
        {label}
      </span>
    </button>
  );
}

const CHIP_COLORS = ['#e11d2e', '#0a6b5c', '#1368ce', '#d89e00', '#26890c', '#0e7490'];

export function playerChipColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % CHIP_COLORS.length;
  return CHIP_COLORS[hash];
}
