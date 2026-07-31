import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { badRequest } from '@/server/lib/errors';
import { funnelEventSchema, recordFunnel } from '@/server/lib/funnel';
import { readVisitorId } from '@/server/lib/price-arm';
import { assertRateLimit, clientIp } from '@/server/lib/rate-limit';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'mb_sid';
const SESSION_MAX_AGE = 2 * 3600; // a visit, not a lifetime

// A page-load can produce a handful of events; a batch keeps that to one request.
const bodySchema = z.object({
  events: z.array(funnelEventSchema).min(1).max(20),
});

// ---- POST /api/v1/events — anonymous funnel telemetry ----
//
// Anonymous by necessity: the interesting part of the funnel happens before
// anyone signs in, and the existing per-book events endpoint needs a book id and
// a parent JWT — so it starts measuring at exactly the point where most people
// have already gone.
//
// The event name and every property are validated against a closed schema. That
// is what keeps this measuring behaviour rather than people: there is no string
// property in the vocabulary, so a child's details cannot arrive here even by
// accident, which is the realistic way that happens.
export async function POST(req: Request): Promise<Response> {
  try {
    assertRateLimit(`events:${clientIp(req)}`, 120, 60_000);
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid event payload', parsed.error.issues);

    const existing = readSessionId(req);
    const sessionId = existing ?? randomUUID();
    const arm = await armFor(readVisitorId(req));

    for (const e of parsed.data.events) {
      await recordFunnel(e.event, { sessionId, arm, path: e.path ?? null, props: e.props });
    }

    const headers = new Headers();
    if (!existing) headers.append('set-cookie', sessionCookie(sessionId));
    return Response.json({ ok: true }, { headers });
  } catch (err) {
    return jsonError(err);
  }
}

function readSessionId(req: Request): string | null {
  const cookie = req.headers.get('cookie');
  const match = cookie?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([0-9a-f-]{36})`));
  return match?.[1] ?? null;
}

function sessionCookie(id: string): string {
  return [
    `${SESSION_COOKIE}=${id}`,
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** The visitor's price arm, so the funnel can be read per arm. */
async function armFor(visitorId: string | null): Promise<'A' | 'B' | null> {
  if (!visitorId) return null;
  try {
    const { data } = await serviceClient()
      .from('price_arm_assignments')
      .select('arm')
      .eq('visitor_id', visitorId)
      .maybeSingle();
    return (data as { arm: 'A' | 'B' } | null)?.arm ?? null;
  } catch {
    return null;
  }
}
