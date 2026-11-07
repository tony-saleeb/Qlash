import type { Metadata } from 'next';
import PlayJoinClient from '@/app/play/PlayJoinClient';
import { readRequestLocale } from '@/lib/i18n/requestLocale';
import { PLAY_DESCRIPTION, PLAY_TITLE } from '@/lib/siteMeta';

export const metadata: Metadata = {
  title: PLAY_TITLE,
  description: PLAY_DESCRIPTION,
  openGraph: {
    title: PLAY_TITLE,
    description: PLAY_DESCRIPTION,
  },
};

export default async function PlayJoinPage() {
  return <PlayJoinClient initialLocale={await readRequestLocale()} />;
}
