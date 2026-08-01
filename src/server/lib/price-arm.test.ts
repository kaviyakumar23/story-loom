import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

/**
 * One visitor, one price, for as long as they are deciding.
 *
 * A price that changes between the landing page and the checkout is a broken
 * promise whatever the experiment says, so the arm is assigned once and read
 * back thereafter. The assignment is also balanced rather than random: with 75
 * orders, a coin flip can deal 60/40 and leave the comparison unreadable.
 */
const h = vi.hoisted(() => ({ db: null as MockDb | null, seq: 0 }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { armForSeq, armForVisitor, readVisitorId, resolveArm, visitorCookie } from './price-arm';

const ID = '11111111-1111-4111-8111-111111111111';

function db(existing: { arm: 'A' | 'B' } | null) {
  return makeSupabase({
    tables: { price_arm_assignments: { data: existing } },
    rpc: { next_price_arm_block: () => ({ data: h.seq }) },
  });
}

describe('price arm assignment', () => {
  beforeEach(() => { h.seq = 0; });

  it('keeps the arms level across a block rather than flipping a coin', () => {
    const first8 = Array.from({ length: 8 }, (_, i) => armForSeq(i));
    expect(first8.filter((a) => a === 'A')).toHaveLength(4);
    expect(first8.filter((a) => a === 'B')).toHaveLength(4);
  });

  // Strict alternation would make the arm guessable from position, which matters
  // if we ever recruit in ordered batches.
  it('does not simply alternate', () => {
    expect([armForSeq(0), armForSeq(1), armForSeq(2), armForSeq(3)]).toEqual(['A', 'B', 'B', 'A']);
  });

  it('gives a returning visitor the price they were already shown', async () => {
    h.db = db({ arm: 'B' });
    const result = await resolveArm(ID);
    expect(result).toMatchObject({ arm: 'B', amount: 149900, display: '₹1,499', isNew: false });
  });

  it('assigns and remembers an arm for a first-time visitor', async () => {
    h.db = db(null);
    const result = await resolveArm(null);
    expect(result.isNew).toBe(true);
    expect(['A', 'B']).toContain(result.arm);
    expect(h.db.ops.some((o) => o.table === 'price_arm_assignments' && o.op === 'upsert')).toBe(true);
  });

  it('stamps the recorded arm onto the order, not one supplied by the client', async () => {
    h.db = db({ arm: 'B' });
    expect(await armForVisitor(ID)).toBe('B');
  });

  it('falls back to a real price for a visitor we have never seen', async () => {
    h.db = db(null);
    expect(await armForVisitor(null)).toBe('A');
  });
});

describe('visitor cookie', () => {
  it('reads an id back out of a cookie header', () => {
    const req = new Request('https://m/', { headers: { cookie: `other=1; mb_vid=${ID}; z=2` } });
    expect(readVisitorId(req)).toBe(ID);
  });

  it('ignores a malformed id rather than trusting it', () => {
    const req = new Request('https://m/', { headers: { cookie: 'mb_vid=not-a-uuid' } });
    expect(readVisitorId(req)).toBeNull();
  });

  // A client that can rewrite this can shop for the cheaper price and poison
  // the experiment.
  it('is httpOnly and same-site', () => {
    const cookie = visitorCookie(ID);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });
});
