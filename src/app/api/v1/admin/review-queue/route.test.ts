import { describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, admin: true }));
vi.mock('@/server/auth', () => ({ requireAdmin: () => { if (!h.admin) throw Object.assign(new Error('forbidden'), { name: 'ApiError' }); } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { GET } from './route';
const get = () => GET(new Request('https://m/api/v1/admin/review-queue'));

describe('GET /api/v1/admin/review-queue (integration)', () => {
  it('lists the failed/blocked books awaiting human review', async () => {
    h.admin = true;
    h.db = makeSupabase({ tables: { books: { data: [{ id: 'b1', status: 'failed', error: { code: 'moderation_blocked' } }] } } });
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { books: { status: string }[] };
    expect(body.books).toHaveLength(1);
    expect(body.books[0].status).toBe('failed');
  });
});
