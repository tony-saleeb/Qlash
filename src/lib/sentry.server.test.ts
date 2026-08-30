import { describe, expect, it, vi } from 'vitest';

describe('initServerSentry', () => {
  it('does nothing without a DSN', async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const init = vi.fn();
    vi.doMock('@sentry/node', () => ({ init }));
    const { initServerSentry } = await import('@/lib/sentry.server');
    await initServerSentry();
    expect(init).not.toHaveBeenCalled();
  });
});
