'use client';

import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/locale';

export function LocaleToggle({
  locale,
  onChange,
  tone = 'ink',
  className,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
  tone?: 'ink' | 'light';
  className?: string;
}) {
  const border = tone === 'light' ? 'border-white/35 text-white' : 'border-arena-ink text-arena-ink';
  const active = tone === 'light' ? 'bg-white text-arena-ink' : 'bg-arena-ink text-white';
  const idle = tone === 'light' ? 'text-white/70 hover:text-white' : 'text-arena-ink/55 hover:text-arena-ink';

  return (
    <div className={cn('inline-flex overflow-hidden border-2 text-[11px] font-extrabold uppercase tracking-wider', border, className)}>
      <button
        type="button"
        onClick={() => onChange('en')}
        className={cn('h-8 px-2.5', locale === 'en' ? active : idle)}
        aria-pressed={locale === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('ar')}
        className={cn('h-8 px-2.5', locale === 'ar' ? active : idle)}
        aria-pressed={locale === 'ar'}
      >
        ع
      </button>
    </div>
  );
}
