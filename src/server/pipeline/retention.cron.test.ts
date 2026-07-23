import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlerOf, makeStep } from '../test/inngest-harness';
import { makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, removed: [] as string[][] }));

vi.mock('@/server/pipeline/client', () => ({ inngest: { createFunction: (_c: unknown, handler: unknown) => ({ handler }) }, EVENTS: {} }));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ PREVIEW_RETENTION_DAYS: 30 }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/storage', () => ({ removeAssets: async (k: string[]) => { h.removed.push(k); } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { retentionPurge } from './retention';

describe('retentionPurge cron', () => {
  beforeEach(() => { h.removed = []; });

  it('purges an expired preview and its now-orphaned hero (objects before rows)', async () => {
    h.db = makeSupabase({
      tables: {
        books: (op, ctx) => {
          if (op === 'delete') return { data: null };
          // find-expired vs "is the hero still used?" (filters on hero_id)
          return ctx.filters.some((f) => f.m === 'in' && f.args[0] === 'hero_id')
            ? { data: [] } // no other book uses hero h1 → it's an orphan
            : { data: [{ id: 'bk1', hero_id: 'h1' }] };
        },
        assets: (_op, ctx) => ({ data: ctx.filters.some((f) => f.m === 'in' && f.args[0] === 'hero_id') ? [{ storage_key: 'hero-asset' }] : [{ storage_key: 'book-asset' }] }),
        character_sheets: { data: [{ reference_pack: { images: [{ storageKey: 'sheet-img' }] } }] },
        heroes: { data: null },
      },
    });
    const out = (await handlerOf(retentionPurge)({ step: makeStep() })) as { purged: number; heroesPurged: number };
    expect(out).toEqual({ purged: 1, heroesPurged: 1 });
    expect(h.removed).toContainEqual(['book-asset']); // book objects
    expect(h.removed).toContainEqual(['sheet-img', 'hero-asset']); // orphan-hero objects
  });

  it('does nothing when no previews have expired', async () => {
    h.db = makeSupabase({ tables: { books: { data: [] } } });
    const out = (await handlerOf(retentionPurge)({ step: makeStep() })) as { purged: number; heroesPurged: number };
    expect(out).toEqual({ purged: 0, heroesPurged: 0 });
    expect(h.removed).toHaveLength(0);
  });
});
