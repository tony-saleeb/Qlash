'use client';

import { useEffect } from 'react';

export function RegisterPlaySw() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/play/sw.js', { scope: '/play' });
  }, []);
  return null;
}
