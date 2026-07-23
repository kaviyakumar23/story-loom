import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { DELETE, POST } from './route';

const post = (b: unknown) => POST(new Request('https://m/api/v1/consent', { method: 'POST', body: JSON.stringify(b) }));
const del = (qs = '') => DELETE(new Request(`https://m/api/v1/consent${qs}`, { method: 'DELETE' }));

describe('consent route (integration)', () => {
  beforeEach(() => { h.db = makeSupabase({ tables: { consent_records: { data: { id: 'c1' } } } }); });

  it('records base consent WITHOUT a scope key (uses the DB default)', async () => {
    const res = await post({ consentVersion: '2026-01-policy-v1', method: 'explicit_checkbox' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ consentId: 'c1' });
    const ins = findOp(h.db!, 'consent_records', 'insert');
    expect(ins?.values).not.toHaveProperty('scope');
  });

  it('records a scoped photo consent when scope is given', async () => {
    const res = await post({ consentVersion: '2026-08-photo-v1', method: 'explicit_checkbox', scope: 'photo_likeness' });
    expect(res.status).toBe(201);
    expect(findOp(h.db!, 'consent_records', 'insert')?.values).toMatchObject({ scope: 'photo_likeness' });
  });

  it('withdraws ALL live consents when no scope is given', async () => {
    h.db = makeSupabase({ tables: { consent_records: { data: [{ id: 'c1' }, { id: 'c2' }] } } });
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ withdrawn: 2 });
    const upd = findOp(h.db!, 'consent_records', 'update');
    expect(upd?.filters.some((f) => f.m === 'eq' && f.args[0] === 'scope')).toBe(false);
  });

  it('withdraws only the requested scope when ?scope= is given', async () => {
    h.db = makeSupabase({ tables: { consent_records: { data: [{ id: 'c1' }] } } });
    const res = await del('?scope=photo_likeness');
    expect(res.status).toBe(200);
    const upd = findOp(h.db!, 'consent_records', 'update');
    expect(upd?.filters.some((f) => f.m === 'eq' && f.args[0] === 'scope' && f.args[1] === 'photo_likeness')).toBe(true);
  });
});
