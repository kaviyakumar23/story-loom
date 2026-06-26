import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { badRequest, forbidden, notFound } from '@/server/lib/errors';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import type { OrderStatusResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/payments/:orderId — poll order status post-checkout (§8) ----
export async function GET(req: Request, ctx: { params: Promise<{ orderId: string }> }): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { orderId } = await ctx.params;
    if (!z.string().uuid().safeParse(orderId).success) throw badRequest('Invalid order id');

    const { data } = await serviceClient()
      .from('orders')
      .select('id, parent_id, book_id, tier, status')
      .eq('id', orderId)
      .maybeSingle();
    if (!data) throw notFound('Order not found');
    if ((data as { parent_id: string }).parent_id !== parent.id) throw forbidden();

    return Response.json({
      orderId: data.id,
      status: data.status,
      bookId: data.book_id,
      tier: data.tier,
    } satisfies OrderStatusResponse);
  } catch (err) {
    return jsonError(err);
  }
}
