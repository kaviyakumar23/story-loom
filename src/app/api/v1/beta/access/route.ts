import { z } from 'zod';
import { badRequest, forbidden } from '@/server/lib/errors';
import {
  betaAccessCookie,
  betaAccessStatus,
  isValidBetaCode,
} from '@/server/lib/beta-access';
import { assertRateLimit, clientIp } from '@/server/lib/rate-limit';
import { jsonError, readJson } from '@/server/lib/route';
import type { BetaAccessResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().min(1).max(80),
});

// ---- GET /api/v1/beta/access — whether invite-code access is required/granted ----
export async function GET(req: Request): Promise<Response> {
  try {
    return Response.json(betaAccessStatus(req) satisfies BetaAccessResponse);
  } catch (err) {
    return jsonError(err);
  }
}

// ---- POST /api/v1/beta/access — validate invite code and grant this browser ----
export async function POST(req: Request): Promise<Response> {
  try {
    // One shared secret guards the whole beta, and this route is unauthenticated
    // — without a limit it can be guessed at network speed.
    assertRateLimit(`beta:${clientIp(req)}`, 5, 60_000);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid invite code payload', parsed.error.issues);
    if (!isValidBetaCode(parsed.data.code)) throw forbidden('That invite code is not valid.');

    return Response.json(
      { enabled: true, granted: true } satisfies BetaAccessResponse,
      { headers: { 'set-cookie': betaAccessCookie() } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
