import { beforeAll, describe, expect, it } from 'vitest';
import { assertPhotoEgressAllowed, photoKey } from './photo-intake';
import { downloadAsset, signAsset, uploadAsset } from './storage';

describe('photo egress guards', () => {
  beforeAll(() => {
    // Minimal env for loadEnv, with a NON-Vertex backend so the character-sheet
    // egress guard must fail closed.
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    process.env.SUPABASE_ANON_KEY = 'test-anon';
    process.env.GEMINI_BACKEND = 'studio';
  });

  it('allows the moderation destination (OpenAI, pre-use)', () => {
    expect(() => assertPhotoEgressAllowed('moderation')).not.toThrow();
  });

  it('refuses the character-sheet egress when the backend is not Vertex', () => {
    expect(() => assertPhotoEgressAllowed('character_sheet')).toThrow(/not Vertex/i);
  });

  it('refuses an unknown destination', () => {
    // @ts-expect-error — deliberately invalid destination
    expect(() => assertPhotoEgressAllowed('somewhere_else')).toThrow();
  });

  it('keys the photo under the parent, without a bucket prefix', () => {
    expect(photoKey('p1', 'u1')).toBe('p1/u1.jpg');
  });
});

describe('assets store refuses photo-intake keys', () => {
  const key = 'photo-intake/p1/u1.jpg';
  it('signAsset rejects it', async () => {
    await expect(signAsset(key)).rejects.toThrow(/photo-intake/i);
  });
  it('uploadAsset rejects it', async () => {
    await expect(uploadAsset(key, Buffer.from(''), 'image/jpeg')).rejects.toThrow(/photo-intake/i);
  });
  it('downloadAsset rejects it', async () => {
    await expect(downloadAsset(key)).rejects.toThrow(/photo-intake/i);
  });
});
