'use client';

import { useMemo } from 'react';
import { AnswerMark } from '@/components/brand/AnswerMark';
import { BrandLogo } from '@/components/brand/BrandMark';
import {
  buildLobbyQrModel,
  QR_ACID,
  QR_COURT,
  QR_INK,
  QR_LIGHT,
  QR_SIGNAL,
  QR_VIOLET,
} from '@/lib/game/lobbyQr';
import { cn } from '@/lib/utils';

const SEAL = 80;
const WELL = 56;
const WELL_X = (SEAL - WELL) / 2;
const WELL_Y = 11;
const TILE = 13;

function FinderEye({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <g>
      <rect x={x} y={y} width={7} height={7} rx={1.15} fill={fill} />
      <rect x={x + 1.05} y={y + 1.05} width={4.9} height={4.9} rx={0.7} fill={QR_LIGHT} />
      <rect x={x + 2.15} y={y + 2.15} width={2.7} height={2.7} rx={0.35} fill={fill} />
    </g>
  );
}

function CornerTile({
  x,
  y,
  fill,
  shape,
  ink,
  delay,
}: {
  x: number;
  y: number;
  fill: string;
  shape: string;
  ink?: boolean;
  delay: string;
}) {
  const mark = 7.2;
  const inset = (TILE - mark) / 2;
  return (
    <g className="motion-seal-tile" style={{ animationDelay: delay }}>
      <rect x={x} y={y} width={TILE} height={TILE} fill={fill} />
      <AnswerMark
        shape={shape}
        x={x + inset}
        y={y + inset}
        width={mark}
        height={mark}
        color={ink ? QR_INK : QR_LIGHT}
      />
    </g>
  );
}

export function LobbyQr({
  value,
  caption,
  className,
}: {
  value: string;
  caption?: string;
  className?: string;
}) {
  const model = useMemo(() => buildLobbyQrModel(value), [value]);
  const qrScale = model ? (WELL - 6) / model.viewBox : 1;

  return (
    <div
      dir="ltr"
      className={cn(
        'ltr-isolate flex w-[min(100%,22rem,72svw,calc(52svh*80/90))] max-w-full shrink-0 flex-col items-center',
        className
      )}
    >
      <div className="relative w-full motion-breathe">
        {model ? (
          <svg
            viewBox={`0 0 ${SEAL} 90`}
            className="h-auto w-full motion-rise"
            role="img"
            aria-label="Lobby QR code"
          >
            <title>Lobby QR code</title>
            <rect width={SEAL} height={90} fill={QR_INK} />
            <path fill={QR_SIGNAL} d="M0 0h22v4H0z" />
            <path fill={QR_ACID} d="M58 0h22v4H58z" />
            <path fill={QR_VIOLET} d="M0 86h28v4H0z" />
            <path fill={QR_COURT} d="M52 86h28v4H52z" />
            <g className="motion-seal-slash">
              <path fill={QR_ACID} d="M63 48 80 65v12L55 44z" />
              <path fill={QR_SIGNAL} d="M68 52 80 64v8L64 48z" />
            </g>

            <rect
              className="motion-seal-well"
              x={WELL_X - 1.2}
              y={WELL_Y - 1.2}
              width={WELL + 2.4}
              height={WELL + 2.4}
              fill={QR_ACID}
            />
            <rect x={WELL_X} y={WELL_Y} width={WELL} height={WELL} fill={QR_LIGHT} />

            <g transform={`translate(${WELL_X + 3} ${WELL_Y + 3}) scale(${qrScale})`}>
              {model.modules.map((cell) => (
                <circle
                  key={`${cell.row}-${cell.col}`}
                  cx={model.margin + cell.col + 0.5}
                  cy={model.margin + cell.row + 0.5}
                  r={0.42}
                  fill={cell.fill}
                />
              ))}
              {model.finders.map((finder) => (
                <FinderEye
                  key={finder.corner}
                  x={model.margin + finder.col}
                  y={model.margin + finder.row}
                  fill={finder.fill}
                />
              ))}
              <g className="motion-seal-logo">
                <circle
                  cx={model.logo.x + model.logo.size / 2}
                  cy={model.logo.y + model.logo.size / 2}
                  r={model.logo.size / 2 + model.logo.pad + 0.15}
                  fill={QR_LIGHT}
                />
                <circle
                  cx={model.logo.x + model.logo.size / 2}
                  cy={model.logo.y + model.logo.size / 2}
                  r={model.logo.size / 2 + 0.12}
                  fill={QR_ACID}
                />
                <circle
                  cx={model.logo.x + model.logo.size / 2}
                  cy={model.logo.y + model.logo.size / 2}
                  r={model.logo.size / 2 - 0.22}
                  fill={QR_SIGNAL}
                />
                <BrandLogo
                  x={model.logo.x + 0.15}
                  y={model.logo.y + 0.15}
                  width={model.logo.size - 0.3}
                  height={model.logo.size - 0.3}
                  color={QR_LIGHT}
                  slashFill={QR_ACID}
                />
              </g>
            </g>

            <CornerTile x={2} y={2} fill={QR_SIGNAL} shape="slash" delay="0s" />
            <CornerTile x={SEAL - TILE - 2} y={2} fill={QR_VIOLET} shape="qring" delay="0.18s" />
            <CornerTile x={2} y={65} fill={QR_COURT} shape="chevron" delay="0.36s" />
            <CornerTile x={SEAL - TILE - 2} y={65} fill={QR_ACID} shape="bolt" ink delay="0.54s" />
          </svg>
        ) : (
          <div className="aspect-[80/90] w-full animate-pulse bg-arena-stage" aria-hidden />
        )}
      </div>
      {caption ? (
        <span className="mt-2 font-display text-[11px] font-extrabold uppercase tracking-[0.28em] text-arena-acid motion-pulse-soft sm:mt-3 sm:text-sm sm:tracking-[0.32em]">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
