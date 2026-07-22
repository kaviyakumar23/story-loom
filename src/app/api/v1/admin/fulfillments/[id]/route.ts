import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, notFound } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual founder workflow: print_ready → printing → shipped → delivered; any
// open state can be cancelled. Enforced so a status can't skip or go backwards.
const NEXT: Record<string, string[]> = {
  print_ready: ['printing', 'cancelled'],
  printing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
const TS_FIELD: Record<string, string> = {
  printing: 'printed_at',
  shipped: 'shipped_at',
  delivered: 'delivered_at',
  cancelled: 'cancelled_at',
};

const patchSchema = z.object({
  status: z.enum(['printing', 'shipped', 'delivered', 'cancelled']).optional(),
  carrier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

// ---- PATCH /api/v1/admin/fulfillments/[id] — advance a print order ----
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(req);
    const { id } = await params;
    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid update', parsed.error.issues);
    const db = serviceClient();

    const { data: current } = await db.from('fulfillments').select('id, status, tracking_number').eq('id', id).maybeSingle();
    if (!current) throw notFound('Fulfillment not found');
    const from = (current as { status: string; tracking_number: string | null }).status;

    const patch: Record<string, unknown> = {};
    const next = parsed.data.status;
    if (next) {
      if (!NEXT[from]?.includes(next)) throw badRequest(`Cannot move a ${from} order to ${next}`);
      const tracking = parsed.data.trackingNumber ?? (current as { tracking_number: string | null }).tracking_number;
      if (next === 'shipped' && !tracking) throw badRequest('A tracking number is required to mark an order shipped');
      patch.status = next;
      patch[TS_FIELD[next]] = new Date().toISOString();
    }
    if (parsed.data.carrier !== undefined) patch.carrier = parsed.data.carrier;
    if (parsed.data.trackingNumber !== undefined) patch.tracking_number = parsed.data.trackingNumber;
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
    if (Object.keys(patch).length === 0) throw badRequest('Nothing to update');

    const { data: updated, error } = await db.from('fulfillments').update(patch).eq('id', id).select('id, status').single();
    if (error) throw badRequest('Update failed', error.message);
    await audit({ actor: 'admin', action: `fulfillment.${next ?? 'updated'}`, entity: 'fulfillments', entityId: id, metadata: patch });

    return Response.json({ fulfillment: updated });
  } catch (err) {
    return jsonError(err);
  }
}
