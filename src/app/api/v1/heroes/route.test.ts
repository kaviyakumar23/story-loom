import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, parentId: 'p1' }));

vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: h.parentId }) }));

import { GET } from './route';

const get = () => GET(new Request('https://m/api/v1/heroes'));

describe('GET /api/v1/heroes (account metadata list)', () => {
  beforeEach(() => { h.parentId = 'p1'; });

  it("lists the parent's heroes with their likeness source — photo wins over attributes", async () => {
    h.db = makeSupabase({
      tables: {
        heroes: { data: [{ id: 'h1', nickname: 'Mia' }, { id: 'h2', nickname: 'Dev' }, { id: 'h3', nickname: 'Zara' }] },
        character_sheets: { data: [
          { hero_id: 'h1', source: 'attributes' },
          { hero_id: 'h1', source: 'photo' }, // second sheet from a photo → 'photo' is what the parent may remove
          { hero_id: 'h2', source: 'attributes' },
        ] },
      },
    });
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { heroes: { id: string; nickname: string; likeness: string | null }[] };
    expect(body.heroes).toEqual([
      { id: 'h1', nickname: 'Mia', likeness: 'photo' },
      { id: 'h2', nickname: 'Dev', likeness: 'attributes' },
      { id: 'h3', nickname: 'Zara', likeness: null },
    ]);
  });

  it('scopes the heroes query to the authenticated parent', async () => {
    h.db = makeSupabase({ tables: { heroes: { data: [] } } });
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ heroes: [] });
    const op = h.db.ops.find((o) => o.table === 'heroes' && o.op === 'select');
    expect(op?.filters).toContainEqual(expect.objectContaining({ m: 'eq', args: ['parent_id', 'p1'] }));
  });

  it('returns metadata only — no avatar, interests, or photo fields', async () => {
    h.db = makeSupabase({
      tables: {
        heroes: { data: [{ id: 'h1', nickname: 'Mia' }] },
        character_sheets: { data: [] },
      },
    });
    const body = (await (await get()).json()) as { heroes: Record<string, unknown>[] };
    expect(Object.keys(body.heroes[0]).sort()).toEqual(['id', 'likeness', 'nickname']);
  });
});
