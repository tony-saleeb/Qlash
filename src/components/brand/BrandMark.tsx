import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { AnswerMark } from '@/components/brand/AnswerMark';
import { answerMarkClass, answerUsesInk, resolveAnswerColor } from '@/lib/game/marks';
import { LOBBY_REACTION_MARKS, type LobbyReactionId } from '@/lib/game/reactions';

export const BRAND_NAME = 'Qlash';

/** Square-Q with a clash slash — reads at favicon size and on a projector. */
export function BrandLogo({
  className,
  slashClassName,
  slashFill,
  ...svgProps
}: SVGProps<SVGSVGElement> & {
  slashClassName?: string;
  slashFill?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden {...svgProps}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M6 6h16v16H6V6Zm4.25 4.25h7.5v7.5h-7.5v-7.5Z"
      />
      <path
        className={slashClassName}
        fill={slashFill}
        d="M16.8 18.4 25.6 27.2l2.8-2.8-8.8-8.8-2.8 2.8Z"
      />
      <path
        className={slashClassName}
        fill={slashFill}
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
      dir="ltr"
      className={cn(
        'ltr-isolate flex items-center justify-center gap-1.5 sm:gap-2',
        className
      )}
      aria-label={`PIN ${pin}`}
    >
      {digits.map((d, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex items-center justify-center border-2 border-arena-ink bg-white font-display font-extrabold tabular-nums text-arena-ink',
            large ? 'h-11 w-8 text-2xl sm:h-14 sm:w-11 sm:text-3xl lg:h-16 lg:w-12 lg:text-4xl' : 'h-10 w-8 text-xl',
            i === 3 && 'ml-1.5 sm:ml-2'
          )}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

export function StageBadge({ children, className }: { children: ReactNode; className?: string }) {
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

/** Four Qlash marks — slash, Q-ring, bolt, chevron. */
export function ArenaFloor({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none relative aspect-square w-full max-w-lg', className)} aria-hidden>
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4">
        <div className="arena-shape-tile flex items-center justify-center bg-arena-signal motion-tile-1">
          <AnswerMark shape="slash" className="h-14 w-14 text-white sm:h-20 sm:w-20" />
        </div>
        <div className="arena-shape-tile flex items-center justify-center bg-[#4a2aff] motion-tile-2">
          <AnswerMark shape="qring" className="h-14 w-14 text-white sm:h-20 sm:w-20" />
        </div>
        <div className="arena-shape-tile flex items-center justify-center bg-arena-acid motion-tile-3">
          <AnswerMark shape="bolt" className="h-14 w-14 text-arena-ink sm:h-20 sm:w-20" />
        </div>
        <div className="arena-shape-tile flex items-center justify-center bg-arena-court motion-tile-4">
          <AnswerMark shape="chevron" className="h-14 w-14 text-white sm:h-20 sm:w-20" />
        </div>
      </div>
    </div>
  );
}

/** Compact looping marks for the player lobby wait. Tappable when onPick is set. */
export function LobbyWaitMarks({
  className,
  onPick,
}: {
  className?: string;
  onPick?: (mark: LobbyReactionId) => void;
}) {
  const interactive = Boolean(onPick);
  return (
    <div
      className={cn('flex items-end justify-center gap-2', className)}
      aria-hidden={!interactive}
    >
      {LOBBY_REACTION_MARKS.map((mark, i) => {
        const body = (
          <span
            className={cn('inline-flex h-11 w-11 items-center justify-center motion-wait-bounce', mark.colorClass)}
            style={{ animationDelay: `${i * 0.14}s` }}
          >
            <AnswerMark shape={mark.id} className={cn('h-5 w-5', mark.markClass)} />
          </span>
        );
        if (!onPick) return <span key={mark.id}>{body}</span>;
        return (
          <button
            key={mark.id}
            type="button"
            onClick={() => onPick(mark.id)}
            aria-label={mark.id}
            className="rounded-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arena-ink"
          >
            {body}
          </button>
        );
      })}
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
  const bg = resolveAnswerColor(color);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'arena-answer group relative flex min-h-[6.25rem] flex-col items-center justify-center gap-2 overflow-hidden p-3 text-center transition active:translate-y-1 active:shadow-none sm:min-h-[7.5rem] sm:p-4',
        answerUsesInk(bg) ? 'text-arena-ink' : 'text-white',
        selected && 'ring-4 ring-white ring-offset-2 ring-offset-transparent',
        className
      )}
      style={{ backgroundColor: bg }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent" />
      <AnswerMark shape={shape} className={cn('h-9 w-9 shrink-0 drop-shadow-sm', answerMarkClass(bg))} />
      <span dir="auto" className="line-clamp-3 max-w-full px-1 font-display text-sm font-extrabold leading-snug sm:text-base">
        {label}
      </span>
    </button>
  );
}

const CHIP_COLORS = ['#e11d2e', '#4a2aff', '#0a6b5c', '#ff2d6a', '#0a0c10', '#155eef'];

export function playerChipColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % CHIP_COLORS.length;
  return CHIP_COLORS[hash];
}
