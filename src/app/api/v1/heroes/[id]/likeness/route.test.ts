import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, removedAssets: [] as string[][], removedPhotos: [] as string[][] }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/storage', () => ({ removeAssets: async (k: string[]) => { h.removedAssets.push(k); } }));
vi.mock('@/server/lib/photo-intake', () => ({ removePhotos: async (k: string[]) => { h.removedPhotos.push(k); } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { DELETE } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const del = () => DELETE(new Request(`https://m/api/v1/heroes/${ID}/likeness`, { method: 'DELETE' }), { params: Promise.resolve({ id: ID }) });

describe('DELETE /heroes/:id/likeness (integration)', () => {
  beforeEach(() => { h.removedAssets = []; h.removedPhotos = []; });

  it('purges the hero’s character sheets, their images, and any pending photo', async () => {
    h.db = makeSupabase({
      tables: {
        heroes: { data: { id: ID, parent_id: 'p1' } },
        character_sheets: { data: [{ reference_pack: { images: [{ storageKey: 'heroes/x/sheet/t.png' }] } }] },
        photo_uploads: (op) => (op === 'select' ? { data: [{ id: 'pu1', storage_key: 'p1/pu1.jpg' }] } : { data: null }),
      },
    });
    const res = await del();
    expect(res.status).toBe(200);
    expect(h.removedAssets).toContainEqual(['heroes/x/sheet/t.png']);
    expect(h.removedPhotos).toContainEqual(['p1/pu1.jpg']);
    expect(findOp(h.db!, 'character_sheets', 'delete')).toBeDefined();
    expect(findOp(h.db!, 'photo_uploads', 'update')?.values).toMatchObject({ status: 'expired' });
  });

  it('forbids removing a likeness for someone else’s hero', async () => {
    h.db = makeSupabase({ tables: { heroes: { data: { id: ID, parent_id: 'other' } } } });
    const res = await del();
    expect(res.status).toBe(403);
    expect(h.removedAssets).toHaveLength(0);
  });
});
