import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ APP_BASE_URL: 'https://moonbell.in' }) }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { DELETE, POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID }) };
const ownedBook = (status = 'preview_ready') => ({ books: { data: { id: ID, parent_id: 'p1', status, deleted_at: null } } });

describe('books/:id/share (integration)', () => {
  beforeEach(() => { h.db = null; });

  it('creates a hashed, expiring share link and returns a share URL', async () => {
    h.db = makeSupabase({ tables: { ...ownedBook(), book_share_links: { error: null } } });
    const res = await POST(new Request(`https://m/api/v1/books/${ID}/share`, { method: 'POST' }), ctx);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { shareUrl: string; expiresAt: string };
    expect(body.shareUrl).toMatch(/\/share\/[A-Za-z0-9_-]+$/);
    const ins = findOp(h.db!, 'book_share_links', 'insert')?.values as { token_hash: string; book_id: string };
    expect(ins.book_id).toBe(ID);
    expect(ins.token_hash).toBeTruthy();
    // The raw token is NOT what we store — only its hash.
    expect(body.shareUrl).not.toContain(ins.token_hash);
  });

  it('refuses to share a book that has not reached preview_ready', async () => {
    h.db = makeSupabase({ tables: ownedBook('generating') });
    const res = await POST(new Request(`https://m/api/v1/books/${ID}/share`, { method: 'POST' }), ctx);
    expect(res.status).toBe(400);
  });

  it('DELETE revokes active links and reports the count', async () => {
    h.db = makeSupabase({ tables: { ...ownedBook(), book_share_links: { data: [{ id: 'sl1' }, { id: 'sl2' }] } } });
    const res = await DELETE(new Request(`https://m/api/v1/books/${ID}/share`, { method: 'DELETE' }), ctx);
    expect(await res.json()).toMatchObject({ revoked: 2 });
  });
});
