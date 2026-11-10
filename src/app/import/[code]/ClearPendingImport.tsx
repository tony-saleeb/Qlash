'use client';

import { useEffect } from 'react';

/** The pending code has reached the confirm screen. Drop it so sign-in cannot import twice. */
export function ClearPendingImport() {
  useEffect(() => {
    try {
      sessionStorage.removeItem('qlash_import');
    } catch {
      // ignore
    }
  }, []);
  return null;
}
