'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyDocumentLocale,
  normalizeLocale,
  resolveClientLocale,
  writeStoredLocale,
  type Locale,
} from '@/lib/i18n/locale';
import { t, type MessageKey } from '@/lib/i18n/messages';

export function useLocale(initial?: Locale) {
  const [locale, setLocaleState] = useState<Locale>(() => normalizeLocale(initial));

  useEffect(() => {
    const next = resolveClientLocale(initial);
    setLocaleState(next);
    applyDocumentLocale(next);
  }, [initial]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
    applyDocumentLocale(next);
  }, []);

  const translate = useCallback((key: MessageKey) => t(locale, key), [locale]);

  return { locale, setLocale, t: translate };
}
