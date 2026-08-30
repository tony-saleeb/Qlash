import { initServerSentry } from '@/lib/sentry.server';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  await initServerSentry();
}
