import { createHash, timingSafeEqual } from 'node:crypto';
import { loadEnv } from './config/env';
import { forbidden, unauthorized } from './lib/errors';
import { serviceClient, verifyUserToken } from './lib/supabase';

/**
 * Auth for Next route handlers (§5, §9). The parent is always the account
 * holder; children never have accounts. Every data query is owner-scoped to the
 * returned parent id.
 */
export interface Parent {
  id: string;
  email: string | null;
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h || !h.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

/** Verify the Supabase JWT and ensure a profiles row. Throws ApiError(401) if invalid. */
export async function requireParent(req: Request): Promise<Parent> {
  const token = bearer(req);
  if (!token) throw unauthorized();
  const user = await verifyUserToken(token);
  if (!user) throw unauthorized('Invalid or expired session');
  await serviceClient()
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
  return { id: user.id, email: user.email };
}

/** Gate /api/v1/admin/* with the static admin secret (§5). */
export function requireAdmin(req: Request): void {
  const token = bearer(req);
  const secret = loadEnv().ADMIN_API_SECRET;
  if (!secret) throw forbidden('Admin API is not configured');
  // Hash both sides so the comparison is constant-time and length-independent.
  const a = createHash('sha256').update(token ?? '').digest();
  const b = createHash('sha256').update(secret).digest();
  if (!token || !timingSafeEqual(a, b)) throw forbidden('Admin access required');
}
