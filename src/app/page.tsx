import LandingClient from '@/app/LandingClient';
import { readRequestLocale } from '@/lib/i18n/requestLocale';

export default async function LandingPage() {
  return <LandingClient initialLocale={await readRequestLocale()} />;
}
