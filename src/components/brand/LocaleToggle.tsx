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
  const track =
    tone === 'light'
      ? 'border-white/50 bg-black/35 text-white'
      : 'border-arena-ink bg-white text-arena-ink';
  const active = tone === 'light' ? 'bg-white text-arena-ink' : 'bg-arena-ink text-white';
  const idle = tone === 'light' ? 'text-white hover:bg-white/15' : 'text-arena-ink/70 hover:text-arena-ink';

  return (
    <div
      dir="ltr"
      className={cn(
        'inline-flex overflow-hidden border-2 text-[11px] font-extrabold tracking-wider',
        track,
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange('en')}
        className={cn('h-8 min-w-8 px-2.5', locale === 'en' ? active : idle)}
        aria-pressed={locale === 'en'}
        aria-label="English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('ar')}
        className={cn('h-8 min-w-8 px-2.5 font-black', locale === 'ar' ? active : idle)}
        aria-pressed={locale === 'ar'}
        aria-label="العربية"
      >
        ع
      </button>
    </div>
  );
}
