import { describe, expect, it } from 'vitest';
import { hostOpClientError, hostOpRequestAllowed } from '@/lib/host/hostOpGuard';

function request(headers: Record<string, string>, url = 'http://localhost/api/host/op') {
  return new Request(url, { method: 'POST', headers });
}

describe('host operation requests', () => {
  it('accepts a same-origin JSON request and refuses a cross-site one', () => {
    expect(
      hostOpRequestAllowed(
        request({
          'content-type': 'application/json',
          origin: 'http://localhost',
          'sec-fetch-site': 'same-origin',
        })
      )
    ).toBe(true);
    expect(
      hostOpRequestAllowed(
        request({
          'content-type': 'application/json',
          origin: 'https://evil.example',
          'sec-fetch-site': 'cross-site',
        })
      )
    ).toBe(false);
    expect(hostOpRequestAllowed(request({ 'content-type': 'text/plain', origin: 'http://localhost' }))).toBe(false);
    expect(hostOpRequestAllowed(request({ 'content-type': 'application/json' }))).toBe(false);
  });

  it('hides a database error and keeps a quiz message', () => {
    expect(hostOpClientError(new Error('duplicate key value violates unique constraint "quizzes_pkey"'))).toEqual({
      status: 400,
      message: 'Could not complete that.',
    });
    expect(hostOpClientError(new Error('new row violates row-level security policy'))).toEqual({
      status: 400,
      message: 'Could not complete that.',
    });
    expect(hostOpClientError(new Error('Quiz not found or unauthorized.'))).toEqual({
      status: 400,
      message: 'Quiz not found or unauthorized.',
    });
    expect(hostOpClientError(new Error('Unauthorized. Please log in.'))).toEqual({
      status: 401,
      message: 'Unauthorized. Please log in.',
    });
  });
});