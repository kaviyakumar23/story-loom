import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

/**
 * Evidence that the funnel measures behaviour and cannot measure people.
 *
 * The endpoint is anonymous by necessity — the interesting part of the funnel
 * happens before anyone signs in — which makes the shape of what it accepts the
 * only thing standing between "how many people reached checkout" and an
 * accidental store of children's names. So the vocabulary is closed on both
 * axes: known event names, and properties that are numbers and enums with no
 * free-text field anywhere in the schema.
 */
const h = vi.hoisted(() => ({ db: null as MockDb | null, recorded: [] as unknown[] }));

vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/lib/rate-limit', () => ({ assertRateLimit: () => {}, clientIp: () => '203.0.113.1' }));
vi.mock('@/server/lib/price-arm', () => ({ readVisitorId: () => null }));
vi.mock('@/server/lib/funnel', async (orig) => {
  const actual = await orig<typeof import('@/server/lib/funnel')>();
  return { ...actual, recordFunnel: async (e: string, o: unknown) => { h.recorded.push([e, o]); } };
});

import { POST } from './route';

const post = (body: unknown) =>
  POST(new Request('https://m/api/v1/events', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/v1/events', () => {
  beforeEach(() => { h.db = makeSupabase({}); h.recorded = []; });

  it('records a batch of known events', async () => {
    const res = await post({
      events: [
        { event: 'landing_view', path: '/' },
        { event: 'scroll_depth', path: '/', props: { depth: 50 } },
        { event: 'cta_click', path: '/', props: { target: 'hero' } },
      ],
    });
    expect(res.status).toBe(200);
    expect(h.recorded.map((r) => (r as [string])[0])).toEqual(['landing_view', 'scroll_depth', 'cta_click']);
  });

  it('sets a session cookie on the first event of a visit', async () => {
    const res = await post({ events: [{ event: 'landing_view' }] });
    expect(res.headers.get('set-cookie')).toMatch(/mb_sid=[0-9a-f-]{36}.*HttpOnly/);
  });

  // A typo becomes a rejected request today rather than a hole in a report next
  // month.
  it('rejects an event name that is not in the vocabulary', async () => {
    const res = await post({ events: [{ event: 'checkout_completed_maybe' }] });
    expect(res.status).toBe(400);
    expect(h.recorded).toHaveLength(0);
  });

  // The realistic leak is not malice — it is somebody passing a form object
  // straight through. The schema has no field that would accept it.
  it('rejects properties that are not in the closed schema', async () => {
    const res = await post({ events: [{ event: 'preview_start', props: { nickname: 'Aarav' } }] });
    expect(res.status).toBe(400);
    expect(h.recorded).toHaveLength(0);
  });

  it('rejects free text smuggled into a known property', async () => {
    const res = await post({ events: [{ event: 'intake_error', props: { reason: 'Aarav Sharma, 5, Bengaluru' } }] });
    expect(res.status).toBe(400);
    expect(h.recorded).toHaveLength(0);
  });

  it('accepts a machine-readable reason code', async () => {
    const res = await post({ events: [{ event: 'payment_failed', props: { reason: 'cap_total' } }] });
    expect(res.status).toBe(200);
  });

  it('caps a batch so one request cannot become a bulk write', async () => {
    const res = await post({ events: Array.from({ length: 40 }, () => ({ event: 'scroll_depth', props: { depth: 25 } })) });
    expect(res.status).toBe(400);
    expect(h.recorded).toHaveLength(0);
  });

  it('rejects an empty batch rather than recording nothing quietly', async () => {
    expect((await post({ events: [] })).status).toBe(400);
  });
});
