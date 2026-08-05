import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  flag: 'true',
  serverFlag: 'true',
  moderationAllowed: true,
  rateLimited: false,
  puts: [] as unknown[][],
}));

vi.mock('@/server/config/env', () => ({
  loadEnv: () => ({
    NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED: h.flag,
    PHOTO_LIKENESS_SERVER_ENABLED: h.serverFlag,
  }),
}));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/beta-access', () => ({ assertBetaAccess: () => {} }));
vi.mock('@/server/lib/rate-limit', async () => {
  const { ApiError } = await vi.importActual<typeof import('@/server/lib/errors')>('@/server/lib/errors');
  return {
    assertRateLimit: () => {
      if (h.rateLimited) throw new ApiError(429, 'rate_limited', 'Too many uploads — please try again in an hour.');
    },
  };
});
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/providers/index', () => ({
  getProviders: () => ({ moderator: { moderateImage: async () => ({ allowed: h.moderationAllowed, reasons: h.moderationAllowed ? [] : ['minors'], raw: {} }) } }),
}));
vi.mock('@/server/lib/photo-intake', () => ({
  putPhoto: async (...a: unknown[]) => { h.puts.push(a); },
  photoKey: (parentId: string, uploadId: string) => `${parentId}/${uploadId}.jpg`,
  assertPhotoEgressAllowed: () => {}, // real impl no-ops for the 'moderation' destination
}));
// sharp is a native image lib — stub a self-chaining pipeline so no real decode happens.
vi.mock('sharp', () => {
  const chain = {
    rotate: () => chain,
    resize: () => chain,
    jpeg: () => chain,
    toBuffer: async () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]),
  };
  return { default: () => chain };
});

import { POST } from './route';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);

function form(bytes: Buffer, consentId = 'c1', type = 'image/jpeg') {
  const fd = new FormData();
  fd.append('photo', new Blob([Uint8Array.from(bytes)], { type }), 'p.jpg');
  fd.append('consentId', consentId);
  return new Request('https://m/api/v1/heroes/photo', { method: 'POST', body: fd });
}

const liveConsent = { consent_records: { data: { id: 'c1', scope: 'photo_likeness', withdrawn_at: null } } };

describe('POST /api/v1/heroes/photo (integration)', () => {
  beforeEach(() => { h.flag = 'true'; h.serverFlag = 'true'; h.moderationAllowed = true; h.rateLimited = false; h.puts = []; });

  it('is 403 when the feature flag is off (before anything else)', async () => {
    h.flag = 'false';
    h.db = makeSupabase({});
    const res = await POST(form(JPEG));
    expect(res.status).toBe(403);
    expect(h.db.ops).toHaveLength(0);
  });

  // The NEXT_PUBLIC_ flag is inlined at build time, so a stale deployment can
  // still render the uploader. The runtime server flag has to be able to refuse
  // on its own, or "photos are off" would depend on a redeploy landing.
  it('is 403 on the server flag alone, even with the public flag still on', async () => {
    h.serverFlag = 'false';
    h.db = makeSupabase({});
    const res = await POST(form(JPEG));
    expect(res.status).toBe(403);
    expect(h.db.ops).toHaveLength(0);
    expect(h.puts).toHaveLength(0);
  });

  it('accepts a valid, moderated photo: stores it and records the upload', async () => {
    h.db = makeSupabase({ tables: { ...liveConsent, photo_uploads: { data: { id: 'pu1' } } } });
    const res = await POST(form(JPEG));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ photoUploadId: 'pu1' });
    expect(h.puts).toHaveLength(1); // stored exactly once
    expect(findOp(h.db, 'photo_uploads', 'insert')?.values).toMatchObject({ status: 'approved' });
  });

  it('rejects a blocked photo WITHOUT storing it (422, nothing put)', async () => {
    h.moderationAllowed = false;
    h.db = makeSupabase({ tables: { ...liveConsent } });
    const res = await POST(form(JPEG));
    expect(res.status).toBe(422);
    expect(h.puts).toHaveLength(0);
    expect(findOp(h.db, 'photo_uploads', 'insert')).toBeUndefined();
  });

  it('rejects non-image bytes by magic-byte sniff (400)', async () => {
    h.db = makeSupabase({ tables: { ...liveConsent } });
    const res = await POST(form(Buffer.from('this is definitely not an image at all')));
    expect(res.status).toBe(400);
    expect(h.puts).toHaveLength(0);
  });

  it('rejects a withdrawn or wrong-scope consent (400)', async () => {
    h.db = makeSupabase({ tables: { consent_records: { data: { id: 'c1', scope: 'photo_likeness', withdrawn_at: '2026-01-01' } } } });
    const res = await POST(form(JPEG));
    expect(res.status).toBe(400);
    expect(h.puts).toHaveLength(0);
  });

  it('rejects an oversized file (>8 MB) before sniffing, decoding, or storing', async () => {
    h.db = makeSupabase({ tables: { ...liveConsent } });
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8 * 1024 * 1024)]);
    const res = await POST(form(big));
    expect(res.status).toBe(400);
    expect(h.puts).toHaveLength(0);
  });

  it('rejects a spoofed extension/MIME: declared image/png, bytes are a script (400)', async () => {
    h.db = makeSupabase({ tables: { ...liveConsent } });
    // Declared type and filename lie; the magic-byte sniff is what must decide.
    const fd = new FormData();
    fd.append('photo', new Blob([new TextEncoder().encode('#!/bin/sh\nrm -rf /')], { type: 'image/png' }), 'innocent.png');
    fd.append('consentId', 'c1');
    const res = await POST(new Request('https://m/api/v1/heroes/photo', { method: 'POST', body: fd }));
    expect(res.status).toBe(400);
    expect(h.puts).toHaveLength(0);
  });

  it('is rate-limited: the 4th upload inside an hour is 429 with nothing stored', async () => {
    h.rateLimited = true;
    h.db = makeSupabase({ tables: { ...liveConsent } });
    const res = await POST(form(JPEG));
    expect(res.status).toBe(429);
    expect(h.puts).toHaveLength(0);
    // The limiter runs before the body is even parsed, so no DB work either.
    expect(h.db.ops).toHaveLength(0);
  });
});
