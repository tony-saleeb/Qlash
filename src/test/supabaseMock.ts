import { vi } from 'vitest';

export type QueryResult = {
  data?: unknown;
  error?: { message?: string; code?: string } | null;
  count?: number | null;
};

type TableQueue = QueryResult | QueryResult[];

export function createQueryChain(getResult: () => QueryResult) {
  const captured: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};

  const wrap = (method: string) =>
    vi.fn((...args: unknown[]) => {
      captured.push({ method, args });
      return chain;
    });

  for (const method of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'order',
    'limit',
    'range',
    'is',
    'not',
    'match',
    'filter',
    'or',
    'gte',
    'lte',
    'contains',
  ]) {
    chain[method] = wrap(method);
  }

  chain.maybeSingle = vi.fn(async () => getResult());
  chain.single = vi.fn(async () => getResult());
  chain.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(getResult()).then(onFulfilled, onRejected);
  chain._captured = captured;
  return chain;
}

export function createClientMock(user = { id: 'host-1', email: 'host@qlash.test' }) {
  const tables: Record<string, TableQueue> = {};
  const indexes: Record<string, number> = {};
  const rpcMap: Record<string, QueryResult | ((args: unknown) => QueryResult)> = {};
  const fromCalls: { table: string; chain: ReturnType<typeof createQueryChain> }[] = [];

  const nextResult = (table: string): QueryResult => {
    const queued = tables[table];
    if (Array.isArray(queued)) {
      const i = indexes[table] ?? 0;
      indexes[table] = i + 1;
      return queued[Math.min(i, queued.length - 1)] ?? { data: null, error: null };
    }
    return queued ?? { data: null, error: null };
  };

  const from = vi.fn((table: string) => {
    const chain = createQueryChain(() => nextResult(table));
    fromCalls.push({ table, chain });
    return chain;
  });

  const rpc = vi.fn(async (name: string, args?: unknown) => {
    const entry = rpcMap[name];
    if (typeof entry === 'function') return entry(args);
    return entry ?? { data: null, error: null };
  });

  const channel = vi.fn(() => {
    const ch: {
      on: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
    } = {
      on: vi.fn(() => ch),
      subscribe: vi.fn((cb?: (status: string) => void) => {
        cb?.('SUBSCRIBED');
        return ch;
      }),
      send: vi.fn(async () => 'ok'),
    };
    return ch;
  });

  return {
    from,
    rpc,
    channel,
    removeChannel: vi.fn(),
    fromCalls,
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: user ? { user } : null },
      })),
      getUser: vi.fn(async () => ({
        data: { user },
        error: user ? null : { message: 'Unauthorized' },
      })),
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    setTable(table: string, result: TableQueue) {
      tables[table] = result;
      indexes[table] = 0;
    },
    setTables(map: Record<string, TableQueue>) {
      for (const [table, result] of Object.entries(map)) {
        tables[table] = result;
        indexes[table] = 0;
      }
    },
    setRpc(name: string, result: QueryResult | ((args: unknown) => QueryResult)) {
      rpcMap[name] = result;
    },
    lastInsert(table: string) {
      const call = [...fromCalls].reverse().find((entry) => entry.table === table);
      const captured = (call?.chain as { _captured?: { method: string; args: unknown[] }[] })._captured;
      return captured?.find((item) => item.method === 'insert')?.args[0];
    },
    lastUpdate(table: string) {
      const call = [...fromCalls].reverse().find((entry) => entry.table === table);
      const captured = (call?.chain as { _captured?: { method: string; args: unknown[] }[] })._captured;
      return captured?.find((item) => item.method === 'update')?.args[0];
    },
    reset() {
      for (const key of Object.keys(tables)) delete tables[key];
      for (const key of Object.keys(indexes)) delete indexes[key];
      for (const key of Object.keys(rpcMap)) delete rpcMap[key];
      fromCalls.length = 0;
      from.mockClear();
      rpc.mockClear();
      this.auth.getUser.mockReset();
      this.auth.getUser.mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'Unauthorized' },
      });
      this.auth.getSession.mockReset();
      this.auth.getSession.mockResolvedValue({
        data: { session: user ? { user } : null },
      });
    },
  };
}

export function jsonRequest(body: unknown, headers?: Record<string, string>) {
  return new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

export async function readJson(response: Response) {
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
