import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlerOf, makeStep } from '../test/inngest-harness';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  orphanKeys: [] as { key: string; createdAt: string | null }[],
  removed: [] as string[][],
}));

vi.mock('@/server/pipeline/client', () => ({ inngest: { createFunction: (_c: unknown, handler: unknown) => ({ handler }) }, EVENTS: {} }));
vi.mock('@/server/lib/photo-intake', () => ({
  removePhotos: async (keys: string[]) => { h.removed.push(keys); },
  listAllPhotoKeys: async () => h.orphanKeys,
}));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { photoIntakePurge } from './photo-purge';

describe('photoIntakePurge cron (24h hard TTL)', () => {
  beforeEach(() => { h.orphanKeys = []; h.removed = []; });

  it('deletes stale rows AND orphan objects, marking rows expired', async () => {
    // An orphan object older than 24h (no row).
    h.orphanKeys = [{ key: 'par1/orphan.jpg', createdAt: '2020-01-01T00:00:00Z' }];
    h.db = makeSupabase({ tables: { photo_uploads: (op) => (op === 'select' ? { data: [{ id: 'pu1', storage_key: 'par1/pu1.jpg' }] } : { data: null }) } });
    const out = (await handlerOf(photoIntakePurge)({ step: makeStep() })) as { rows: number; orphans: number };
    expect(out).toEqual({ rows: 1, orphans: 1 });
    expect(h.removed).toContainEqual(['par1/pu1.jpg']); // row-based delete
    expect(h.removed).toContainEqual(['par1/orphan.jpg']); // orphan sweep
    expect(findOp(h.db!, 'photo_uploads', 'update')?.values).toMatchObject({ status: 'expired' });
  });

  it('leaves recent orphans alone', async () => {
    h.orphanKeys = [{ key: 'par1/fresh.jpg', createdAt: new Date().toISOString() }];
    h.db = makeSupabase({ tables: { photo_uploads: { data: [] } } });
    const out = (await handlerOf(photoIntakePurge)({ step: makeStep() })) as { rows: number; orphans: number };
    expect(out).toEqual({ rows: 0, orphans: 0 });
    expect(h.removed).toHaveLength(0);
  });
});
