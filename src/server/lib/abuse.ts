import { createHash } from 'node:crypto';
import { loadEnv } from '../config/env';
import { sendAdminAlert } from './email';
import { ApiError } from './errors';
import { clientIp } from './rate-limit';
import { serviceClient } from './supabase';

/**
 * Free-generation abuse controls (layered). Anonymous sign-in mints accounts for
 * free, so per-account caps alone are farmable; these are the guardrails that
 * actually bound spend once the invite gate opens:
 *
 *   1. Global daily circuit-breaker — the financial hard stop.
 *   2. Email gate — the 1st preview is fully anonymous (conversion magic);
 *      the 2nd+ needs a CONFIRMED email (caps farming, captures the lead).
 *   3. Per-IP daily cap — DB-backed (holds across serverless instances),
 *      IPs stored only as salted hashes (DPDP minimisation), generous.
 *
 * Paid customers bypass all three (proven human, revenue, likely reordering).
 * Turnstile stays deferred until scripted abuse is actually observed.
 */

type Db = ReturnType<typeof serviceClient>;

/** True if this parent has ever completed a payment — bypasses the abuse gates. */
export async function hasPaidOrder(db: Db, parentId: string): Promise<boolean> {
  const { count } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId)
    .eq('status', 'paid');
  return (count ?? 0) > 0;
}

/**
 * Layer 1 — global daily circuit-breaker. Counts ALL books created in the last
 * 24h; at/over the cap, free preview creation pauses until tomorrow. The read is
 * advisory (a tiny race overshoot is fine for a breaker), and the founder is
 * alerted once as the cap trips.
 */
export async function assertGlobalPreviewBudget(db: Db): Promise<void> {
  const cap = loadEnv().GLOBAL_DAILY_PREVIEW_CAP;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db
    .from('books')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  const used = count ?? 0;
  if (used < cap) return;

  if (used === cap) {
    // First rejection of the day (±races) — tell the founder the breaker tripped.
    try {
      await sendAdminAlert('Global daily preview cap reached — free previews paused', { cap, used });
    } catch {
      /* best-effort */
    }
  }
  throw new ApiError(
    503,
    'at_capacity',
    'We’re making a lot of books today and have paused new free previews to keep quality high. Please come back tomorrow!',
  );
}

/**
 * Layer 2 — email gate. After EMAIL_GATE_AFTER_PREVIEWS lifetime previews, the
 * account must have a CONFIRMED email before creating another. The client shows
 * an add-your-email step on this error code.
 */
export async function assertEmailGate(db: Db, parentId: string): Promise<void> {
  const allowed = loadEnv().EMAIL_GATE_AFTER_PREVIEWS;
  const { count } = await db
    .from('books')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId);
  if ((count ?? 0) < allowed) return;

  const { data } = await db.auth.admin.getUserById(parentId);
  const user = data.user as { email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
  const confirmed = Boolean(user?.email && (user.email_confirmed_at || user.confirmed_at));
  if (!confirmed) {
    throw new ApiError(
      403,
      'email_required',
      'To make another book, add and confirm your email first — it keeps your stories safe and stops misuse of the free preview.',
    );
  }
}

/**
 * Layer 3 — per-IP daily cap. Atomic increment-then-check on a DB row keyed by
 * (salted ip hash, day), so it holds across serverless instances. Rejected
 * attempts still count (deliberate: hammering doesn't reset the meter).
 */
export async function bumpAndAssertIpCap(db: Db, req: Request): Promise<void> {
  const env = loadEnv();
  const cap = env.PREVIEW_IP_DAILY_CAP;
  const ip = clientIp(req);
  if (ip === 'unknown') return; // no address to key on — the other layers hold
  const ipHash = hashIp(ip);
  const day = new Date().toISOString().slice(0, 10);

  // Atomic upsert-increment via SQL function (an app-side read-modify-write
  // would race across serverless instances).
  const { data, error } = await db.rpc('bump_preview_ip', { p_ip_hash: ipHash, p_day: day });
  if (error) {
    // Fail OPEN on infrastructure errors — the global breaker and per-account
    // caps still bound spend; an IP-counter outage must not take down creates.
    return;
  }
  if (Number(data) > cap) {
    throw new ApiError(
      429,
      'ip_capped',
      'This network has reached today’s free-preview limit. Please try again tomorrow.',
    );
  }
}

/** Salted SHA-256 of the IP — we can rate-limit an address without storing it. */
export function hashIp(ip: string): string {
  const env = loadEnv();
  const salt = env.IP_HASH_SECRET || createHash('sha256').update(`ip-salt:${env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex');
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
