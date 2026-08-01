import { z } from 'zod';
import { METRO_LABELS, SERVICEABLE_SUMMARY, metroForPincode } from '@/server/config/beta-geo';
import { badRequest } from '@/server/lib/errors';
import { assertRateLimit, clientIp } from '@/server/lib/rate-limit';
import { jsonError, readJson } from '@/server/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
});

// ---- POST /api/v1/beta/pincode — can we actually deliver there? ----
//
// Asked BEFORE the Razorpay window opens. The beta ships to three metros the
// founder can reach a courier in; taking money for an address we cannot serve
// and sorting it out afterwards is a refund and a bad first impression, not a
// growth experiment.
//
// Anonymous on purpose: a visitor should be able to find out whether we deliver
// to them before creating anything.
export async function POST(req: Request): Promise<Response> {
  try {
    assertRateLimit(`pincode:${clientIp(req)}`, 20, 60_000);
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw badRequest('Enter a valid 6-digit PIN code', parsed.error.issues);
    }

    const metro = metroForPincode(parsed.data.pincode);
    if (!metro) {
      return Response.json({
        serviceable: false,
        metro: null,
        // Name where we DO deliver — a bare "no" leaves someone guessing whether
        // to try again next month or forget about it.
        message: `We're only delivering to ${SERVICEABLE_SUMMARY} while we're in beta. Leave your email and we'll tell you the moment we reach you.`,
      });
    }

    return Response.json({
      serviceable: true,
      metro,
      message: `We deliver to ${METRO_LABELS[metro]} — dispatch within 7 working days.`,
    });
  } catch (err) {
    return jsonError(err);
  }
}
