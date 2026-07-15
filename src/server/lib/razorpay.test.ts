import crypto from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './razorpay';

const SECRET = 'whsec_test_secret';

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// The webhook signature check is what stands between "anyone can POST" and
// "books unlock only when Razorpay says money moved" (§8).
describe('verifyWebhookSignature', () => {
  beforeAll(() => {
    // loadEnv() is lazy — provide the minimum it validates.
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    process.env.SUPABASE_ANON_KEY = 'test-anon';
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  });

  it('accepts a genuine signature over the exact raw body', () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it('rejects when the body was tampered with after signing', () => {
    const body = JSON.stringify({ event: 'payment.captured', amount: 29900 });
    const signature = sign(body);
    const tampered = body.replace('29900', '1');
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(body, sign(body, 'attacker-secret'))).toBe(false);
  });

  it('rejects malformed or truncated signatures without throwing', () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(body, sign(body).slice(0, 10))).toBe(false);
    expect(verifyWebhookSignature(body, 'not-a-signature')).toBe(false);
  });
});
