'use client';

import { useEffect, useRef, useState } from 'react';
import { CLASH_BEAT_MS, CLASH_BEATS, clashBeatLabel } from '@/lib/game/clashCountdown';
import { playClashSound, playTickSound } from '@/lib/sounds';

export function ClashCountdownOverlay({
  play,
  clashWord,
  onDone,
}: {
  play: boolean;
  clashWord: string;
  onDone?: () => void;
}) {
  const [beat, setBeat] = useState<number | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!play) {
      setBeat(null);
      return;
    }
    let index = 0;
    setBeat(CLASH_BEATS[0]);
    playTickSound();
    const id = window.setInterval(() => {
      index += 1;
      if (index >= CLASH_BEATS.length) {
        window.clearInterval(id);
        onDoneRef.current?.();
        return;
      }
      const next = CLASH_BEATS[index];
      setBeat(next);
      if (next === 0) playClashSound();
      else playTickSound();
    }, CLASH_BEAT_MS);
    return () => window.clearInterval(id);
  }, [play]);

  if (!play || beat === null) return null;

  const isClash = beat === 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-arena-ink/80 backdrop-blur-[2px]">
      <p
        className={`font-display font-black uppercase tracking-tight text-white animate-scale-in ${
          isClash ? 'text-7xl text-arena-acid sm:text-8xl' : 'text-8xl sm:text-9xl'
        }`}
      >
        {clashBeatLabel(beat, clashWord)}
      </p>
    </div>
  );
}
