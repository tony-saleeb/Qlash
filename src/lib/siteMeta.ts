export const SITE_NAME = 'Qlash';

/** One Qlash in the tab. Titles that already name the product are left as written. */
export function pageTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return SITE_NAME;
  if (trimmed.includes(SITE_NAME)) return trimmed;
  return `${trimmed} · ${SITE_NAME}`;
}

export const SITE_TITLE = 'Qlash — live classroom quiz';

export const SITE_DESCRIPTION =
  'كويز حي لحد 80 لاعب. ادخلوا بالكود، الشاشة قدام الكل، من غير حساب. Live classroom quiz for Sunday school and Arabic rooms — PIN join, projector-ready.';

export const SITE_DESCRIPTION_EN =
  'Live classroom quiz for up to 80 players. PIN join, no accounts, projector-ready.';

export const PLAY_TITLE = 'Join a Qlash room';

export const PLAY_DESCRIPTION =
  'اكتب اسمك وادخل. من غير حساب. Enter your name — no account needed.';

export const SITE_KEYWORDS = [
  'كويز',
  'قلاش',
  'مدارس الأحد',
  'كويز عربي',
  'classroom quiz',
  'live quiz',
  'Qlash',
  'Sunday school',
];
