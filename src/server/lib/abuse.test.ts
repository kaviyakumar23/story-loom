import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, alerts: 0 }));
vi.mock('../config/env', () => ({
  loadEnv: () => ({
    GLOBAL_DAILY_PREVIEW_CAP: 200,
    PREVIEW_IP_DAILY_CAP: 30,
    EMAIL_GATE_AFTER_PREVIEWS: 1,
    IP_HASH_SECRET: 'unit-salt',
    SUPABASE_SERVICE_ROLE_KEY: 'srk',
  }),
}));
vi.mock('./email', () => ({ sendAdminAlert: async () => { h.alerts += 1; } }));
vi.mock('./supabase', () => ({ serviceClient: () => h.db }));

import { assertEmailGate, assertGlobalPreviewBudget, bumpAndAssertIpCap, hashIp, hasPaidOrder } from './abuse';

const req = (ip?: string) =>
  new Request('https://m/api/v1/books', { method: 'POST', headers: ip ? { 'x-forwarded-for': ip } : {} });

describe('abuse controls', () => {
  beforeEach(() => { h.alerts = 0; });

  describe('hashIp', () => {
    it('is deterministic, salted, and never stores the raw IP', () => {
      const a = hashIp('203.0.113.7');
      expect(a).toBe(hashIp('203.0.113.7'));
      expect(a).not.toBe(hashIp('203.0.113.8'));
      expect(a).toMatch(/^[a-f0-9]{64}$/);
      expect(a).not.toContain('203');
    });
  });

  describe('global circuit-breaker', () => {
    it('passes under the cap', async () => {
      h.db = makeSupabase({ tables: { books: { count: 199 } } });
      await expect(assertGlobalPreviewBudget(h.db as never)).resolves.toBeUndefined();
    });

    it('trips AT the cap with a one-time founder alert (503 at_capacity)', async () => {
      h.db = makeSupabase({ tables: { books: { count: 200 } } });
      await expect(assertGlobalPreviewBudget(h.db as never)).rejects.toMatchObject({ statusCode: 503, code: 'at_capacity' });
      expect(h.alerts).toBe(1);
    });

    it('keeps rejecting past the cap without re-alerting', async () => {
      h.db = makeSupabase({ tables: { books: { count: 240 } } });
      await expect(assertGlobalPreviewBudget(h.db as never)).rejects.toMatchObject({ code: 'at_capacity' });
      expect(h.alerts).toBe(0);
    });
  });

  describe('email gate', () => {
    it('lets the first preview through anonymously (no admin lookup)', async () => {
      h.db = makeSupabase({ tables: { books: { count: 0 } } });
      await expect(assertEmailGate(h.db as never, 'p1')).resolves.toBeUndefined();
    });

    it('blocks the 2nd preview for an email-less anonymous account (403 email_required)', async () => {
      h.db = makeSupabase({ userEmail: null, tables: { books: { count: 1 } } });
      await expect(assertEmailGate(h.db as never, 'p1')).rejects.toMatchObject({ statusCode: 403, code: 'email_required' });
    });

    it('blocks an added-but-UNCONFIRMED email', async () => {
      h.db = makeSupabase({ userEmail: 'p@x.co', userEmailConfirmedAt: null, tables: { books: { count: 1 } } });
      await expect(assertEmailGate(h.db as never, 'p1')).rejects.toMatchObject({ code: 'email_required' });
    });

    it('passes with a confirmed email', async () => {
      h.db = makeSupabase({ userEmail: 'p@x.co', tables: { books: { count: 5 } } });
      await expect(assertEmailGate(h.db as never, 'p1')).resolves.toBeUndefined();
    });
  });

  describe('per-IP cap', () => {
    it('increments atomically and passes under the cap', async () => {
      h.db = makeSupabase({ rpc: { bump_preview_ip: { data: 5 } } });
      await expect(bumpAndAssertIpCap(h.db as never, req('203.0.113.7'))).resolves.toBeUndefined();
      expect(h.db.rpcCalls[0][0]).toBe('bump_preview_ip');
      expect(h.db.rpcCalls[0][1].p_ip_hash).toBe(hashIp('203.0.113.7')); // hashed, never raw
    });

    it('rejects over the cap (429 ip_capped)', async () => {
      h.db = makeSupabase({ rpc: { bump_preview_ip: { data: 31 } } });
      await expect(bumpAndAssertIpCap(h.db as never, req('203.0.113.7'))).rejects.toMatchObject({ statusCode: 429, code: 'ip_capped' });
    });

    it('fails OPEN on a counter outage (other layers still bound spend)', async () => {
      h.db = makeSupabase({ rpc: { bump_preview_ip: { data: null, error: { message: 'down' } } } });
      await expect(bumpAndAssertIpCap(h.db as never, req('203.0.113.7'))).resolves.toBeUndefined();
    });

    it('skips silently when no client IP is derivable', async () => {
      h.db = makeSupabase({});
      await expect(bumpAndAssertIpCap(h.db as never, req())).resolves.toBeUndefined();
      expect(h.db.rpcCalls).toHaveLength(0);
    });
  });

  describe('paid exemption', () => {
    it('detects a paid order', async () => {
      h.db = makeSupabase({ tables: { orders: { count: 1 } } });
      expect(await hasPaidOrder(h.db as never, 'p1')).toBe(true);
    });
    it('is false with no paid orders', async () => {
      h.db = makeSupabase({ tables: { orders: { count: 0 } } });
      expect(await hasPaidOrder(h.db as never, 'p1')).toBe(false);
    });
  });
});
