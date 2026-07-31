import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, internal, notFound } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The things that happen to a printed order that are not a straight line.
 *
 * A book can be shipped, come back as an RTO, be reshipped, and then be
 * delivered. Modelling those as statuses would either lose the history or force
 * a rewrite of the transition machine every time reality produced a new
 * combination, so they are recorded as events with an `open_exception` marker
 * on the fulfilment — the queue can then show "shipped, but returned" without
 * either fact overwriting the other.
 */
const bodySchema = z.object({
  type: z.enum(['reprint', 'reship', 'rto', 'lost', 'note']),
  /** What happened, in the founder's words. This is the record of the incident. */
  note: z.string().trim().max(1000).optional(),
  /** Who or what caused it — drives whether the cost lands on us or a carrier. */
  fault: z.enum(['moonbell', 'printer', 'carrier', 'customer', 'unknown']).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
});

// ---- POST /api/v1/admin/fulfillments/:id/exception ----
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(req);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid exception', parsed.error.issues);
    const db = serviceClient();

    const { data: current } = await db
      .from('fulfillments')
      .select('id, status, book_id, order_id')
      .eq('id', id)
      .maybeSingle();
    if (!current) throw notFound('Fulfillment not found');
    const f = current as { status: string; book_id: string; order_id: string };

    const patch: Record<string, unknown> = {};
    switch (parsed.data.type) {
      case 'reprint':
        // Back to the start of the physical process: a reprint is a new copy,
        // and it goes through QC again like any other.
        patch.status = 'qc_pending';
        patch.open_exception = 'reprint';
        patch.printed_at = null;
        patch.shipped_at = null;
        break;
      case 'reship':
        // The book exists; only the journey failed. A reship needs its own
        // tracking number, or nobody can tell the two attempts apart.
        if (!parsed.data.trackingNumber) throw badRequest('A reship needs the new tracking number');
        patch.status = 'shipped';
        patch.open_exception = 'reship';
        patch.tracking_number = parsed.data.trackingNumber;
        patch.shipped_at = new Date().toISOString();
        break;
      case 'rto':
        patch.open_exception = 'rto';
        break;
      case 'lost':
        patch.open_exception = 'lost';
        break;
      case 'note':
        break;
    }

    if (Object.keys(patch).length) {
      const { error } = await db.from('fulfillments').update(patch).eq('id', id);
      if (error) throw internal('Could not record the exception', error.message);
    }

    const { error: evErr } = await db.from('order_events').insert({
      order_id: f.order_id,
      book_id: f.book_id,
      type: parsed.data.type,
      payload: {
        note: parsed.data.note ?? null,
        fault: parsed.data.fault ?? 'unknown',
        fromStatus: f.status,
        trackingNumber: parsed.data.trackingNumber ?? null,
      },
      actor: 'admin',
    });
    if (evErr) throw internal('Could not record the exception', evErr.message);

    await audit({
      actor: 'admin',
      action: `fulfillment.${parsed.data.type}`,
      entity: 'fulfillments',
      entityId: id,
      metadata: { fault: parsed.data.fault ?? 'unknown', fromStatus: f.status },
    });
    return Response.json({ ok: true, status: patch.status ?? f.status });
  } catch (err) {
    return jsonError(err);
  }
}
