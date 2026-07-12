import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════
   Mock DB — used when SQLite is unavailable (Vercel)
   Returns empty/zero results for all queries so the
   app renders cleanly without crashing.
   ═══════════════════════════════════════════════════ */
function createMockDb(): any {
  const empty = () => Promise.resolve([]);
  const zero = () => Promise.resolve(0);
  const nullResult = () => Promise.resolve(null);
  const writeOk = (args?: any) =>
    Promise.resolve({
      id: args?.where?.id || 'demo-' + Math.random().toString(36).slice(2, 10),
      ...(args?.data || {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  const manyOk = () => Promise.resolve({ count: 0 });

  const modelHandler: ProxyHandler<object> = {
    get(_, method: string) {
      switch (method) {
        case 'findMany':
        case 'groupBy':
        case 'aggregate':
          return empty;
        case 'findFirst':
        case 'findUnique':
          return nullResult;
        case 'count':
          return zero;
        case 'create':
        case 'update':
        case 'upsert':
          return writeOk;
        case 'delete':
          return nullResult;
        case 'createMany':
        case 'updateMany':
        case 'deleteMany':
          return manyOk;
        default:
          return () => Promise.resolve(undefined);
      }
    },
  };

  const modelProxy = new Proxy({}, modelHandler);

  return new Proxy(
    {},
    {
      get(_, prop: string) {
        if (prop.startsWith('$')) return () => Promise.resolve(undefined);
        // Every property access returns the same model proxy
        // (Prisma models all share the same method signatures)
        return modelProxy;
      },
    }
  );
}

/* ═══════════════════════════════════════════════════
   Initialize — try real DB, fall back to mock
   ═══════════════════════════════════════════════════ */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _demoMode = false;

function wrapClient(client: PrismaClient): any {
  // Wrap the real client so that any runtime query error
  // (e.g. SQLite on Vercel's read-only FS) is caught and
  // returns an empty result instead of throwing.
  return new Proxy(client, {
    get(target, prop: string) {
      // $-prefixed helpers ($connect, $disconnect, etc.)
      if (prop.startsWith('$') && prop !== '$queryRaw' && prop !== '$executeRaw') {
        const val = (target as any)[prop];
        return typeof val === 'function'
          ? (...a: any[]) => { try { return val.apply(target, a); } catch { return Promise.resolve(); } }
          : val;
      }

      // Model-level access (db.contact, db.company, etc.)
      const model = (target as any)[prop];
      if (!model || typeof model !== 'object') return model;

      return new Proxy(model, {
        get(mTarget, method: string) {
          const val = (mTarget as any)[method];
          if (typeof val !== 'function') return val;

          // Return a wrapped function that catches DB errors
          return (...args: any[]) => {
            try {
              const result = val.apply(mTarget, args);
              // If it returned a Promise, attach a catch handler
              if (result && typeof result === 'object' && typeof result.catch === 'function') {
                return result.catch(() => {
                  if (method === 'count') return 0;
                  if (method === 'findFirst' || method === 'findUnique') return null;
                  if (method === 'create' || method === 'update' || method === 'upsert') {
                    return { id: 'demo-' + Math.random().toString(36).slice(2, 10), createdAt: new Date(), updatedAt: new Date() };
                  }
                  return []; // findMany, groupBy, etc.
                });
              }
              return result;
            } catch {
              if (method === 'count') return Promise.resolve(0);
              if (method === 'findFirst' || method === 'findUnique') return Promise.resolve(null);
              return Promise.resolve([]);
            }
          };
        },
      });
    },
  });
}

let db: any;

try {
  const raw = globalForPrisma.prisma || new PrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = raw;
  db = wrapClient(raw);
} catch (e) {
  console.warn('[DeepMindQ] PrismaClient init failed — running in demo mode', e);
  _demoMode = true;
  db = createMockDb();
}

export { db };
export function isDemoMode(): boolean {
  return _demoMode;
}