export class HostRegisterError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HostRegisterError';
    this.status = status;
  }
}

export type HostRegisterInput = {
  email: string;
  password: string;
  displayName: string;
};

type AuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

export type HostRegisterAdmin = {
  auth: {
    admin: {
      createUser: (attrs: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata: { display_name: string };
      }) => Promise<{ error: { message?: string } | null }>;
      listUsers: (params: { page: number; perPage: number }) => Promise<{
        data?: { users?: AuthUser[] } | null;
        error: { message?: string } | null;
      }>;
      updateUserById: (
        id: string,
        attrs: { email_confirm: boolean; password?: string }
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

function isAlreadyRegistered(message: string) {
  const lower = message.toLowerCase();
  return lower.includes('already') || lower.includes('registered') || lower.includes('exists');
}

export function parseHostRegisterInput(body: unknown): HostRegisterInput {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
  const password = typeof raw.password === 'string' ? raw.password : '';
  const displayName = typeof raw.displayName === 'string' ? raw.displayName.trim() : '';

  if (!email || !email.includes('@')) {
    throw new HostRegisterError('Please enter a valid email.', 400);
  }
  if (password.length < 6) {
    throw new HostRegisterError('Password must be at least 6 characters.', 400);
  }
  if (!displayName) {
    throw new HostRegisterError('Please enter a display name.', 400);
  }
  if (displayName.length > 40) {
    throw new HostRegisterError('Display name is too long.', 400);
  }
  return { email, password, displayName };
}

export async function createConfirmedHost(admin: HostRegisterAdmin, input: HostRegisterInput) {
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (!created.error) return;

  const message = created.error.message || 'Could not create account.';
  if (!isAlreadyRegistered(message)) {
    throw new HostRegisterError(message, 400);
  }
  throw new HostRegisterError('An account with this email already exists. Sign in.', 409);
}
