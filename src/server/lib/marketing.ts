import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '../config/env';
import { serviceClient } from './supabase';

/**
 * Marketing-consent gate (DPDP §7) and one-click unsubscribe.
 *
 * `profiles.marketing_consent` is captured at book creation but must be READ
 * before every promotional send — the win-back cron and every future lifecycle
 * email route through `canSendMarketing`. Transactional messages (order receipt,
 * "your book is ready", shipping) are service communications and do NOT go
 * through this gate.
 */

/** Stable per-deployment HMAC key for unsubscribe tokens. */
function unsubscribeKey(): string {
  const env = loadEnv();
  if (env.MARKETING_UNSUBSCRIBE_SECRET) return env.MARKETING_UNSUBSCRIBE_SECRET;
  // Fall back to a derived key so unsubscribe works without extra config. The
  // derivation never exposes the service-role key (one-way hash).
  return createHash('sha256').update(`marketing-unsub:${env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex');
}

/** Signature that proves an unsubscribe link was issued by us, for this parent. */
export function unsubscribeSignature(parentId: string): string {
  return createHmac('sha256', unsubscribeKey()).update(parentId).digest('hex');
}

/** Constant-time verification of an unsubscribe token. */
export function verifyUnsubscribeSignature(parentId: string, token: string): boolean {
  if (!token) return false;
  const expected = unsubscribeSignature(parentId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The absolute one-click unsubscribe URL to embed in a marketing email. */
export function unsubscribeUrl(parentId: string): string {
  const base = loadEnv().APP_BASE_URL;
  const params = new URLSearchParams({ u: parentId, t: unsubscribeSignature(parentId) });
  return `${base}/api/v1/marketing/unsubscribe?${params.toString()}`;
}

/** True only if this parent has opted in to marketing email. Fails closed. */
export async function canSendMarketing(parentId: string): Promise<boolean> {
  const { data } = await serviceClient()
    .from('profiles')
    .select('marketing_consent')
    .eq('id', parentId)
    .maybeSingle();
  return (data as { marketing_consent?: boolean } | null)?.marketing_consent === true;
}
