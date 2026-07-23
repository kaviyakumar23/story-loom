import { beforeAll, describe, expect, it } from 'vitest';
import { unsubscribeSignature, unsubscribeUrl, verifyUnsubscribeSignature } from './marketing';

describe('marketing unsubscribe tokens', () => {
  beforeAll(() => {
    // loadEnv() is lazy — provide the minimum it validates, plus a fixed key so
    // signatures don't depend on the derived fallback.
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    process.env.SUPABASE_ANON_KEY = 'test-anon';
    process.env.MARKETING_UNSUBSCRIBE_SECRET = 'unit-test-secret';
    process.env.APP_BASE_URL = 'https://moonbell.in';
  });

  const parent = '11111111-1111-1111-1111-111111111111';

  it('verifies a token it issued', () => {
    const token = unsubscribeSignature(parent);
    expect(verifyUnsubscribeSignature(parent, token)).toBe(true);
  });

  it('rejects a tampered or empty token', () => {
    const token = unsubscribeSignature(parent);
    expect(verifyUnsubscribeSignature(parent, `${token}00`)).toBe(false);
    expect(verifyUnsubscribeSignature(parent, '')).toBe(false);
    expect(verifyUnsubscribeSignature(parent, 'deadbeef')).toBe(false);
  });

  it('is bound to the parent id (a token for one parent fails for another)', () => {
    const token = unsubscribeSignature(parent);
    const other = '22222222-2222-2222-2222-222222222222';
    expect(verifyUnsubscribeSignature(other, token)).toBe(false);
  });

  it('embeds the parent id and a valid token in the URL', () => {
    const url = new URL(unsubscribeUrl(parent));
    expect(url.pathname).toBe('/api/v1/marketing/unsubscribe');
    expect(url.searchParams.get('u')).toBe(parent);
    expect(verifyUnsubscribeSignature(parent, url.searchParams.get('t') ?? '')).toBe(true);
  });
});
