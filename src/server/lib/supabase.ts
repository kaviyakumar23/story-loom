import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from '../config/env';

/**
 * Supabase access (§3, §9).
 *
 * - `serviceClient` uses the service-role key and bypasses RLS. The backend is
 *   trusted, so every query made through it MUST be explicitly owner-scoped in
 *   code (e.g. `.eq('parent_id', parentId)`). RLS policies (migration 0002)
 *   are a defense-in-depth second layer, not the only one.
 * - `verifyUserToken` validates a parent's JWT and returns the auth user.
 */

let _service: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (_service) return _service;
  const env = loadEnv();
  _service = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _service;
}

let _authClient: SupabaseClient | null = null;

function authClient(): SupabaseClient {
  if (_authClient) return _authClient;
  const env = loadEnv();
  _authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _authClient;
}

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Validate a bearer JWT. Returns null if invalid/expired. */
export async function verifyUserToken(token: string): Promise<AuthUser | null> {
  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
