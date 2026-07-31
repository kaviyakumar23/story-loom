import { z } from 'zod';
import { loadEnv } from '@/server/config/env';
import { requireAdmin } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { sendShipped } from '@/server/lib/email';
import { badRequest, conflict, internal, notFound } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The founder's manual workflow, policed so a status cannot skip or go backwards.
 *
 * `qc_pending` is the state that did not exist before: a paid book landed
 * straight in the print queue as "ready", which for something that ends up as a
 * physical object in a child's hands is the wrong default. Somebody has to look
 * at it, and the machine should not let them forget.
 *
 * `print_ready → printing` is deliberately absent here. That transition IS the
 * release, and it goes through release_to_print so the file being sent is
 * recorded immutably and a refund landing at the same moment cannot slip past.
 */
const NEXT: Record<string, string[]> = {
  qc_pending: ['print_ready', 'qc_hold', 'cancelled'],
  qc_hold: ['qc_pending', 'cancelled'],
  print_ready: ['cancelled'],
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
  status: z.enum(['print_ready', 'qc_hold', 'qc_pending', 'shipped', 'delivered', 'cancelled']).optional(),
  carrier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  qcNotes: z.string().trim().max(1000).optional(),
});

// ---- PATCH /api/v1/admin/fulfillments/[id] — advance a print order ----
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(req);
    const { id } = await params;
    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid update', parsed.error.issues);
    const db = serviceClient();

    const { data: current } = await db
      .from('fulfillments')
      .select('id, status, tracking_number, carrier, book_id, order_id')
      .eq('id', id)
      .maybeSingle();
    if (!current) throw notFound('Fulfillment not found');
    const cur = current as {
      status: string;
      tracking_number: string | null;
      carrier: string | null;
      book_id: string;
      order_id: string;
    };
    const from = cur.status;

    // Nothing advances on a refunded order. The old machine never looked at the
    // order at all, so a refunded book could be walked all the way to shipped.
    const { data: order } = await db.from('orders').select('status').eq('id', cur.order_id).maybeSingle();
    const orderStatus = (order as { status: string } | null)?.status;
    if (orderStatus === 'refunded' && parsed.data.status && parsed.data.status !== 'cancelled') {
      throw conflict('This order was refunded — it cannot be advanced.');
    }

    const patch: Record<string, unknown> = {};
    const next = parsed.data.status;
    if (next) {
      if (!NEXT[from]?.includes(next)) throw badRequest(`Cannot move a ${from} order to ${next}`);
      const tracking = parsed.data.trackingNumber ?? cur.tracking_number;
      if (next === 'shipped' && !tracking) throw badRequest('A tracking number is required to mark an order shipped');
      patch.status = next;
      if (TS_FIELD[next]) patch[TS_FIELD[next]] = new Date().toISOString();
      if (next === 'print_ready') patch.qc_passed_at = new Date().toISOString();
    }
    if (parsed.data.carrier !== undefined) patch.carrier = parsed.data.carrier;
    if (parsed.data.trackingNumber !== undefined) patch.tracking_number = parsed.data.trackingNumber;
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
    if (parsed.data.qcNotes !== undefined) patch.qc_notes = parsed.data.qcNotes;
    if (Object.keys(patch).length === 0) throw badRequest('Nothing to update');

    const { data: updated, error } = await db.from('fulfillments').update(patch).eq('id', id).select('id, status').single();
    if (error) throw badRequest('Update failed', error.message);
    await audit({ actor: 'admin', action: `fulfillment.${next ?? 'updated'}`, entity: 'fulfillments', entityId: id, metadata: patch });

    if (next === 'print_ready' || next === 'qc_hold') {
      await db.from('order_events').insert({
        order_id: cur.order_id,
        book_id: cur.book_id,
        type: next === 'print_ready' ? 'qc_pass' : 'qc_hold',
        payload: { notes: parsed.data.qcNotes ?? null },
        actor: 'admin',
      });
    }

    // Notify the parent when their printed book ships (best-effort).
    if (next === 'shipped') {
      try {
        const { data: bk } = await db.from('books').select('parent_id').eq('id', cur.book_id).maybeSingle();
        const parentId = (bk as { parent_id: string } | null)?.parent_id;
        if (parentId) {
          const { data: u } = await db.auth.admin.getUserById(parentId);
          if (u.user?.email) {
            await sendShipped(u.user.email, {
              dashboardUrl: `${loadEnv().APP_BASE_URL}/books/${cur.book_id}`,
              carrier: (patch.carrier as string | undefined) ?? cur.carrier,
              trackingNumber: (patch.tracking_number as string | undefined) ?? cur.tracking_number,
            });
          }
        }
      } catch {
        // shipped email is best-effort; the status change already succeeded.
      }
    }

    return Response.json({ fulfillment: updated });
  } catch (err) {
    return jsonError(err);
  }
}

const releaseSchema = z.object({
  /** Hash of the exact file the reviewer approved, from the preflight record. */
  sha256: z.string().trim().regex(/^[a-f0-9]{64}$/, 'Expected a sha256 hex digest'),
  reviewer: z.string().trim().min(1).max(80),
});

// ---- POST /api/v1/admin/fulfillments/[id] — release to print ----
//
// Separate from the PATCH machine because releasing is not a status change, it
// is a commitment: from here the file exists as a physical object and no
// software can take it back. Two things have to be true at exactly the same
// moment — the order is paid, and the file we are sending is the one that was
// reviewed — so the check and the state change happen in one transaction. Split
// apart, a refund landing between them would let a refunded book go to press.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(req);
    const { id } = await params;
    const parsed = releaseSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid release request', parsed.error.issues);
    const db = serviceClient();

    const { data: fulfillment } = await db
      .from('fulfillments')
      .select('id, book_id, print_master_key')
      .eq('id', id)
      .maybeSingle();
    if (!fulfillment) throw notFound('Fulfillment not found');
    const f = fulfillment as { book_id: string; print_master_key: string | null };

    // The hash must match the master we hold, or the reviewer approved something
    // other than what would be printed.
    const { data: asset } = await db
      .from('assets')
      .select('sha256, storage_key')
      .eq('book_id', f.book_id)
      .eq('type', 'print_master')
      .maybeSingle();
    const stored = (asset as { sha256: string | null; storage_key: string } | null)?.sha256;
    if (!stored) throw conflict('No print master on file for this book.');
    if (stored !== parsed.data.sha256) {
      throw conflict('That is not the file currently on record — reload the queue and check the master again.');
    }

    const { data, error } = await db.rpc('release_to_print', {
      p_fulfillment: id,
      p_sha: parsed.data.sha256,
      p_reviewer: parsed.data.reviewer,
    });
    if (error) throw internal('Could not release to print', error.message);
    const result = (Array.isArray(data) ? data[0] : data) as { released: boolean; reason: string | null } | null;
    if (!result?.released) {
      throw conflict(
        result?.reason === 'order_not_paid'
          ? 'This order is not paid (it may have been refunded).'
          : result?.reason === 'not_ready'
            ? 'This book has not passed QC yet.'
            : 'This book could not be released.',
      );
    }

    await audit({
      actor: 'admin',
      action: 'fulfillment.released',
      entity: 'fulfillments',
      entityId: id,
      metadata: { sha256: parsed.data.sha256, reviewer: parsed.data.reviewer },
    });
    return Response.json({ ok: true, released: true });
  } catch (err) {
    return jsonError(err);
  }
}
