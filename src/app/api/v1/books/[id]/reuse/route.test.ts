import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { GET } from './route';

const ctx = { params: Promise.resolve({ id: 'book-1' }) };
const get = () => GET(new Request('https://m/api/v1/books/book-1/reuse'), ctx);

describe('GET /books/:id/reuse (integration)', () => {
  beforeEach(() => { h.db = null; });

  it('returns the hero details for the owner', async () => {
    h.db = makeSupabase({
      tables: {
        books: { data: { parent_id: 'p1', hero_id: 'h1' } },
        heroes: { data: { id: 'h1', nickname: 'Mia', age_band: '5-6', avatar: { hair: 'short' }, interests: ['space'], birth_month: 3 } },
      },
    });
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ heroId: 'h1', nickname: 'Mia', ageBand: '5-6', avatar: { hair: 'short' }, interests: ['space'], birthMonth: 3 });
  });

  it('forbids a book owned by someone else', async () => {
    h.db = makeSupabase({ tables: { books: { data: { parent_id: 'someone-else', hero_id: 'h1' } } } });
    const res = await get();
    expect(res.status).toBe(403);
  });

  it('404s when the book does not exist', async () => {
    h.db = makeSupabase({ tables: { books: { data: null } } });
    const res = await get();
    expect(res.status).toBe(404);
  });
});
