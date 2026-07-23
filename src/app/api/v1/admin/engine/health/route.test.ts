import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, modImgOk: true }));
vi.mock('@/server/auth', () => ({ requireAdmin: () => {} }));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ MODEL_TIER: 'cost', MAX_IMAGE_ATTEMPTS: 2 }) }));
vi.mock('@/server/lib/storage', () => ({ uploadAsset: async () => {}, signAsset: async () => 'https://signed/x', removeAssets: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/providers', () => ({
  getProviders: () => ({
    text: { name: 'gemini-text', generateStory: async () => ({ value: { title: 'T', pages: [{}, {}] }, usage: { model: 'm', tokensIn: 1, tokensOut: 1 } }) },
    moderator: {
      name: 'omni-moderation',
      moderateText: async () => ({ allowed: true, reasons: [] }),
      moderateImage: async () => ({ allowed: h.modImgOk, reasons: h.modImgOk ? [] : ['unsafe'] }),
    },
    image: { name: 'gemini-image', renderPage: async () => ({ value: { base64: 'aGVsbG8=', mime: 'image/png' }, usage: { model: 'm' } }) },
  }),
}));

import { GET } from './route';
const get = () => GET(new Request('https://m/api/v1/admin/engine/health'));

describe('GET /api/v1/admin/engine/health (integration)', () => {
  beforeEach(() => { h.db = makeSupabase({}); h.modImgOk = true; });

  it('reports ok:true (200) when every provider/storage check passes', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; checks: { name: string; ok: boolean }[] };
    expect(body.ok).toBe(true);
    expect(body.checks.every((c) => c.ok)).toBe(true);
    expect(body.checks.map((c) => c.name)).toContain('image_moderation');
  });

  it('reports ok:false (502) when a check fails (e.g. the test image is blocked)', async () => {
    h.modImgOk = false;
    const res = await get();
    expect(res.status).toBe(502);
    const body = (await res.json()) as { ok: boolean; checks: { name: string; ok: boolean }[] };
    expect(body.ok).toBe(false);
    expect(body.checks.find((c) => c.name === 'image_moderation')?.ok).toBe(false);
  });
});
