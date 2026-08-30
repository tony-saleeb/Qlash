import LandingClient from '@/app/LandingClient';
import { readRequestLocale } from '@/lib/i18n/requestLocale';

export default function LandingPage() {
  return <LandingClient initialLocale={readRequestLocale()} />;
}
