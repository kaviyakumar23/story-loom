import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Evidence for the beta's "photo off" gate.
 *
 * The plan's requirement is stronger than a hidden uploader: with the feature
 * disabled there must be no path — route, pipeline, or storage helper — that
 * accepts, stores, reads or transmits a child's photo. These tests assert the
 * refusals themselves, so the gate has something to point at.
 */
const h = vi.hoisted(() => ({
  serverFlag: 'false',
  publicFlag: 'false',
  uploads: [] as unknown[][],
  downloads: [] as string[],
}));

vi.mock('@/server/config/env', () => ({
  loadEnv: () => ({
    NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED: h.publicFlag,
    PHOTO_LIKENESS_SERVER_ENABLED: h.serverFlag,
  }),
}));
// Vertex is the one backend photos are ever allowed to reach, so the disabled
// checks below can't be passing for the incidental reason of a wrong backend.
vi.mock('@/server/providers/gemini-transport', () => ({ resolveGeminiBackend: () => 'vertex' }));
vi.mock('@/server/lib/supabase', () => ({
  serviceClient: () => ({
    storage: {
      from: () => ({
        upload: async (...a: unknown[]) => { h.uploads.push(a); return { error: null }; },
        download: async (key: string) => { h.downloads.push(key); return { data: null, error: null }; },
      }),
    },
  }),
}));

import { assertPhotoEgressAllowed, getPhoto, putPhoto } from '@/server/lib/photo-intake';

describe('photo likeness disabled — zero egress, zero storage', () => {
  beforeEach(() => { h.serverFlag = 'false'; h.publicFlag = 'false'; h.uploads = []; h.downloads = []; });

  it('refuses every egress destination, including moderation', () => {
    expect(() => assertPhotoEgressAllowed('moderation')).toThrow(/disabled/i);
    expect(() => assertPhotoEgressAllowed('character_sheet')).toThrow(/disabled/i);
  });

  it('refuses to write photo bytes to the intake bucket', async () => {
    await expect(putPhoto('p1/u1.jpg', Buffer.from([0xff, 0xd8]), 'image/jpeg')).rejects.toThrow(/disabled/i);
    expect(h.uploads).toHaveLength(0);
  });

  it('refuses to read photo bytes back out', async () => {
    await expect(getPhoto('p1/u1.jpg')).rejects.toThrow(/disabled/i);
    expect(h.downloads).toHaveLength(0);
  });

  it('stays disabled when only the build-time public flag is on', () => {
    h.publicFlag = 'true';
    expect(() => assertPhotoEgressAllowed('moderation')).toThrow(/disabled/i);
  });

  it('allows moderation egress again once both flags are on', () => {
    h.serverFlag = 'true';
    h.publicFlag = 'true';
    expect(() => assertPhotoEgressAllowed('moderation')).not.toThrow();
    expect(() => assertPhotoEgressAllowed('character_sheet')).not.toThrow();
  });
});
