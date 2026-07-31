import { BRAND } from '@/lib/brand';
import { readVisitorId, resolveArm, visitorCookie } from '@/server/lib/price-arm';
import { jsonError } from '@/server/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/beta/pricing — the one price this visitor sees ----
//
// One visitor, one price, for the whole of their visit. Deciding it here rather
// than in the client means it cannot be shopped by clearing state, and it means
// the landing page and the checkout cannot disagree — a price that changes
// between the two is a broken promise, whatever the experiment says.
export async function GET(req: Request): Promise<Response> {
  try {
    const assignment = await resolveArm(readVisitorId(req));
    const headers = new Headers({ 'cache-control': 'private, no-store' });
    if (assignment.isNew) headers.append('set-cookie', visitorCookie(assignment.visitorId));

    return Response.json(
      {
        // The arm is deliberately NOT returned: the visitor needs a price, and
        // naming which side of a test they are on invites gaming it.
        amount: assignment.amount,
        currency: 'INR',
        display: assignment.display,
        spec: BRAND.product.spec,
        delivery: BRAND.product.delivery,
      },
      { headers },
    );
  } catch (err) {
    return jsonError(err);
  }
}
