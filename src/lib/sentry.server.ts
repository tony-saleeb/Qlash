export async function initServerSentry() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}
