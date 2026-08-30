import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import {
  answerMarkClass,
  resolveAnswerColor,
  resolveMarkId,
  type AnswerMarkId,
} from '@/lib/game/marks';

const MARK_PATHS: Record<AnswerMarkId, ReactNode> = {
  slash: (
    <>
      <path d="M6.5 22.2 19.8 8.9l3.4 3.4L9.9 25.6z" />
      <path d="M13.2 23.4 26.5 10.1l2.6 2.6L15.8 26z" />
    </>
  ),
  qring: (
    <>
      <path
        fillRule="evenodd"
        d="M6 6h16.5v16.5H6V6Zm3.8 3.8h8.9v8.9h-8.9V9.8Z"
      />
      <path d="M18.2 19.4 26.8 28l2.4-2.4-8.6-8.6z" />
    </>
  ),
  bolt: (
    <path d="M19.2 3.2 8.4 16.6h7.4L10.6 28.8 24.8 14.2h-7.2L22.6 3.2z" />
  ),
  chevron: (
    <>
      <path d="M4.8 6.4 15.2 16 4.8 25.6 8.4 16z" />
      <path d="M15.4 6.4 25.8 16 15.4 25.6 19 16z" />
    </>
  ),
  spark: (
    <path d="M16 2.2 18.6 13.4 29.8 16 18.6 18.6 16 29.8 13.4 18.6 2.2 16 13.4 13.4z" />
  ),
  bars: (
    <>
      <path d="M5 15h5.4v12H5z" />
      <path d="M13.3 6h5.4v21h-5.4z" />
      <path d="M21.6 10.5H27v16.5h-5.4z" />
    </>
  ),
};

export function AnswerMark({
  shape,
  className,
  ...svgProps
}: {
  shape: string;
  className?: string;
} & SVGProps<SVGSVGElement>) {
  const id = resolveMarkId(shape);
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden {...svgProps}>
      {MARK_PATHS[id]}
    </svg>
  );
}

export function AnswerSwatch({
  shape,
  color,
  className,
  markClassName,
}: {
  shape: string;
  color: string;
  className?: string;
  markClassName?: string;
}) {
  const bg = resolveAnswerColor(color);
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ backgroundColor: bg }}
    >
      <AnswerMark shape={shape} className={cn(answerMarkClass(bg), markClassName)} />
    </span>
  );
}
