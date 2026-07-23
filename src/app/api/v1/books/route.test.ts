import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  moderationAllowed: true,
  sends: [] as { name: string }[],
}));

vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ PREVIEW_DAILY_CAP: 10 }) }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/beta-access', () => ({ assertBetaAccess: () => {} }));
vi.mock('@/server/lib/rate-limit', () => ({ assertRateLimit: () => {} }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/providers/index', () => ({
  resolveModelStamp: () => ({ modelTier: 'cost', textModel: 't', imageModel: 'i', promptVersion: 'v1' }),
  getProviders: () => ({ moderator: { moderateText: async () => ({ allowed: h.moderationAllowed, reasons: h.moderationAllowed ? [] : ['violence'] }) } }),
}));
vi.mock('@/server/pipeline/client', () => ({
  EVENTS: { previewRequested: 'book/preview.requested' },
  inngest: { send: async (e: { name: string }) => { h.sends.push(e); } },
}));

import { POST } from './route';

const CONSENT = '22222222-2222-4222-8222-222222222222';
function body(over: Record<string, unknown> = {}) {
  return {
    child: { nickname: 'Mia', ageBand: '5-6', avatar: { skinTone: 'medium', hair: 'short', glasses: false }, interests: ['space'], birthMonth: null },
    goal: 'reading_confidence', occasionPack: null, customTheme: 'a story about the sea', language: 'en', readingLevel: 'early',
    consentId: CONSENT, marketingConsent: false, ...over,
  };
}
const post = (b: unknown) => POST(new Request('https://m/api/v1/books', { method: 'POST', body: JSON.stringify(b) }));

/** Live consent, under cap, and a stateful books responder for the full flow. */
function funnelDb() {
  let bookSelect = 0;
  return makeSupabase({
    tables: {
      consent_records: { data: { id: CONSENT, withdrawn_at: null } },
      profiles: { data: null },
      heroes: (op) => (op === 'insert' ? { data: { id: 'hero-1' } } : { data: null }),
      books: (op, ctx) => {
        if (op === 'insert') return { data: { id: 'book-1' } };
        if (ctx.head) return { count: 0 }; // daily-cap pre-check
        bookSelect += 1;
        return bookSelect === 1 ? { data: null } : { data: [{ id: 'book-1' }] }; // idempotency, then cap re-check
      },
    },
  });
}

describe('POST /api/v1/books (integration)', () => {
  beforeEach(() => { h.moderationAllowed = true; h.sends = []; });

  it('rejects an invalid payload before any DB work', async () => {
    h.db = makeSupabase({});
    const res = await post(body({ readingLevel: 'nonsense' }));
    expect(res.status).toBe(400);
    expect(h.db.ops).toHaveLength(0);
  });

  it('refuses a withdrawn consent', async () => {
    h.db = makeSupabase({ tables: { consent_records: { data: { id: CONSENT, withdrawn_at: '2026-01-01' } }, books: (_op, ctx) => (ctx.head ? { count: 0 } : { data: null }) } });
    const res = await post(body());
    expect(res.status).toBe(400);
    expect(h.sends).toHaveLength(0);
  });

  it('rejects blocked free-text (theme/interests) with a friendly 400 — no book created', async () => {
    h.moderationAllowed = false;
    h.db = makeSupabase({ tables: { consent_records: { data: { id: CONSENT, withdrawn_at: null } }, books: (_op, ctx) => (ctx.head ? { count: 0 } : { data: null }) } });
    const res = await post(body());
    expect(res.status).toBe(400);
    expect(findOp(h.db, 'books', 'insert')).toBeUndefined();
    expect(h.sends).toHaveLength(0);
  });

  it('enforces the daily preview cap', async () => {
    h.db = makeSupabase({ tables: { books: (_op, ctx) => (ctx.head ? { count: 10 } : { data: null }) } });
    const res = await post(body());
    expect(res.status).toBe(400);
    expect(h.sends).toHaveLength(0);
  });

  it('creates a book, stamps the model + custom theme, and fires the preview pipeline', async () => {
    h.db = funnelDb();
    const res = await post(body());
    expect(res.status).toBe(202);
    const insert = findOp(h.db, 'books', 'insert');
    expect(insert?.values).toMatchObject({ goal: 'reading_confidence', custom_theme: 'a story about the sea', text_model: 't', image_model: 'i' });
    expect(h.sends.map((s) => s.name)).toContain('book/preview.requested');
  });
});
