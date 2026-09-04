import { describe, expect, it, vi } from 'vitest';
import {
  createConfirmedHost,
  HostRegisterError,
  parseHostRegisterInput,
  type HostRegisterAdmin,
} from '@/lib/host/registerHost';

function adminMock(overrides?: Partial<HostRegisterAdmin['auth']['admin']>): HostRegisterAdmin {
  return {
    auth: {
      admin: {
        createUser: vi.fn(async () => ({ error: null })),
        listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
        updateUserById: vi.fn(async () => ({ error: null })),
        ...overrides,
      },
    },
  };
}

describe('parseHostRegisterInput', () => {
  it('normalizes email and display name', () => {
    expect(
      parseHostRegisterInput({
        email: '  Host@Qlash.test ',
        password: 'secret1',
        displayName: '  Mira  ',
      })
    ).toEqual({
      email: 'host@qlash.test',
      password: 'secret1',
      displayName: 'Mira',
    });
  });

  it('rejects a short password', () => {
    expect(() =>
      parseHostRegisterInput({ email: 'a@b.c', password: '123', displayName: 'Mira' })
    ).toThrow(HostRegisterError);
  });
});

describe('createConfirmedHost', () => {
  it('creates a confirmed host', async () => {
    const admin = adminMock();
    await createConfirmedHost(admin, {
      email: 'host@qlash.test',
      password: 'secret1',
      displayName: 'Mira',
    });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'host@qlash.test',
      password: 'secret1',
      email_confirm: true,
      user_metadata: { display_name: 'Mira' },
    });
  });

  it('does not take over an existing unverified host', async () => {
    const admin = adminMock({
      createUser: vi.fn(async () => ({ error: { message: 'User already registered' } })),
    });
    await expect(
      createConfirmedHost(admin, {
        email: 'host@qlash.test',
        password: 'secret1',
        displayName: 'Mira',
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing confirmed host', async () => {
    const admin = adminMock({
      createUser: vi.fn(async () => ({ error: { message: 'User already registered' } })),
      listUsers: vi.fn(async () => ({
        data: {
          users: [{ id: 'u1', email: 'host@qlash.test', email_confirmed_at: '2026-01-01' }],
        },
        error: null,
      })),
    });
    await expect(
      createConfirmedHost(admin, {
        email: 'host@qlash.test',
        password: 'secret1',
        displayName: 'Mira',
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});
