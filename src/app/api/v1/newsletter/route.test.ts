import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, contacts: [] as string[] }));
vi.mock('@/server/lib/email', () => ({ addNewsletterContact: async (e: string) => { h.contacts.push(e); } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { POST } from './route';

const post = (b: unknown) => POST(new Request('https://m/api/v1/newsletter', { method: 'POST', body: JSON.stringify(b) }));

describe('POST /api/v1/newsletter (integration)', () => {
  beforeEach(() => { h.db = makeSupabase({}); h.contacts = []; });

  it('upserts a normalized email and mirrors it to the audience', async () => {
    const res = await post({ email: '  Parent@Example.COM ', source: 'footer' });
    expect(res.status).toBe(200);
    expect(findOp(h.db!, 'newsletter_subscribers', 'upsert')?.values).toMatchObject({ email: 'parent@example.com', source: 'footer' });
    expect(h.contacts).toEqual(['parent@example.com']);
  });

  it('rejects an invalid email with 400 and never writes', async () => {
    const res = await post({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'newsletter_subscribers', 'upsert')).toBeUndefined();
  });
});
