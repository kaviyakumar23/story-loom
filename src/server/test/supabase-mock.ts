/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test-only fluent mock of the Supabase service client. It records every query
 * and resolves each one from a per-table config, so route/pipeline tests can
 * assert what the code DID (inserted, updated, blocked) without a database.
 *
 * Config value per table is either a fixed result, or a function of the final
 * operation ('select' | 'insert' | 'update' | 'delete' | 'upsert') and context,
 * which lets one table answer reads and writes differently.
 */
export interface QueryResult {
  data?: any;
  error?: any;
  count?: number;
}
export interface QueryCtx {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  values?: any;
  filters: { m: string; args: any[] }[];
  head?: boolean;
}
export type Responder = QueryResult | ((op: QueryCtx['op'], ctx: QueryCtx) => QueryResult);
export type TableConfig = Record<string, Responder>;

export interface MockDb {
  from: (table: string) => any;
  auth: { admin: { getUserById: (id: string) => Promise<any>; deleteUser: (id: string) => Promise<any> } };
  storage: { from: (bucket: string) => any };
  /** Every query the code ran, in order — for assertions. */
  ops: QueryCtx[];
  /** Parent ids passed to auth.admin.deleteUser — for erasure assertions. */
  authDeletes: string[];
}

export interface MockOptions {
  tables?: TableConfig;
  /** email returned by auth.admin.getUserById (null = anonymous). */
  userEmail?: string | null;
  storage?: { upload?: QueryResult; remove?: QueryResult; list?: { data?: any[] } };
}

export function makeSupabase(opts: MockOptions = {}): MockDb {
  const ops: QueryCtx[] = [];
  const tables = opts.tables ?? {};

  const builder = (table: string) => {
    const ctx: QueryCtx = { table, op: 'select', filters: [] };
    const resolve = (): QueryResult => {
      ops.push({ ...ctx, filters: [...ctx.filters] });
      const r = tables[table];
      if (r === undefined) return { data: null, error: null };
      return typeof r === 'function' ? r(ctx.op, ctx) : r;
    };
    const filter = (m: string) => (...args: any[]) => { ctx.filters.push({ m, args }); return chain; };
    const chain: any = {
      select: (_cols?: string, o?: { count?: string; head?: boolean }) => { if (o?.head) ctx.head = true; return chain; },
      insert: (v: any) => { ctx.op = 'insert'; ctx.values = v; return chain; },
      update: (v: any) => { ctx.op = 'update'; ctx.values = v; return chain; },
      delete: () => { ctx.op = 'delete'; return chain; },
      upsert: (v: any) => { ctx.op = 'upsert'; ctx.values = v; return chain; },
      eq: filter('eq'), neq: filter('neq'), in: filter('in'), is: filter('is'),
      gt: filter('gt'), gte: filter('gte'), lt: filter('lt'), lte: filter('lte'),
      not: filter('not'), or: filter('or'), order: filter('order'), limit: filter('limit'), range: filter('range'),
      maybeSingle: () => Promise.resolve(resolve()),
      single: () => Promise.resolve(resolve()),
      then: (onF: any, onR: any) => Promise.resolve(resolve()).then(onF, onR),
    };
    return chain;
  };

  const storageApi = () => ({
    upload: async () => opts.storage?.upload ?? { error: null },
    download: async () => ({ data: null, error: null }),
    remove: async () => opts.storage?.remove ?? { error: null },
    createSignedUrl: async () => ({ data: { signedUrl: 'https://signed.example/x' }, error: null }),
    list: async () => opts.storage?.list ?? { data: [] },
  });

  const authDeletes: string[] = [];
  return {
    ops,
    authDeletes,
    from: builder,
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: opts.userEmail === undefined ? null : { email: opts.userEmail } } }),
        deleteUser: async (id: string) => { authDeletes.push(id); return { error: null }; },
      },
    },
    storage: { from: storageApi },
  };
}

/** Find the first recorded op matching a table + operation (for assertions). */
export function findOp(db: MockDb, table: string, op: QueryCtx['op']): QueryCtx | undefined {
  return db.ops.find((o) => o.table === table && o.op === op);
}
