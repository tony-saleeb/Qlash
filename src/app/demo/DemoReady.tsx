'use client';

import { useEffect, useState } from 'react';

export function DemoReady({
  playersWord,
  notReady,
}: {
  playersWord: string;
  notReady: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/demo/ensure')
      .then((response) => response.json())
      .then((body: { ready?: boolean; playerCount?: number }) => {
        if (cancelled) return;
        if (body?.ready) {
          const count = typeof body.playerCount === 'number' ? body.playerCount : 0;
          setLabel(`${count} ${playersWord}`);
          return;
        }
        setLabel(notReady);
      })
      .catch(() => {
        if (!cancelled) setLabel(notReady);
      });
    return () => {
      cancelled = true;
    };
  }, [notReady, playersWord]);

  if (!label) return <p className="mt-3 h-4" />;
  return <p className="mt-3 text-xs font-semibold text-arena-ink/50">{label}</p>;
}
