import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, internal } from '@/server/lib/errors';
import { eraseParentData, findErasureBlock } from '@/server/lib/erasure';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- POST /api/v1/account/delete — right to erasure (§9) ----
export async function POST(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const db = serviceClient();

    // The pending row is the durable trace of a half-done erasure: on success it
    // cascades away with the account and audit_log keeps the permanent record;
    // if erasure throws, this row stays 'pending' and the request is visible.
    const { data: request, error } = await db
      .from('deletion_requests')
      .insert({ parent_id: parent.id, status: 'pending' })
      .select('id')
      .single();
    if (error || !request) throw internal('Could not create deletion request', error?.message);

    await audit({ actor: 'parent', action: 'account.delete_requested', entity: 'deletion_requests', entityId: request.id });

    // A printed order in flight is the one thing erasure must wait for. Deleting
    // through it used to cascade away the fulfilment row and the shipping
    // address and delete the print master — silently cancelling a book someone
    // had paid for, with nothing left to show it had existed.
    const block = await findErasureBlock(parent.id);
    if (block) {
      await db
        .from('deletion_requests')
        .update({ status: 'deferred', deferred_reason: block.reason, deferred_until: block.retryAfter.toISOString() })
        .eq('id', request.id);
      await audit({
        actor: 'system',
        action: 'account.delete_deferred',
        entity: 'deletion_requests',
        entityId: request.id,
        metadata: { reason: block.reason },
      });
      return Response.json(
        {
          requestId: request.id,
          status: 'deferred',
          reason: block.reason,
          message: 'Your book is already on its way. We\u2019ll delete everything as soon as it has been delivered — you don\u2019t need to do anything else.',
        },
        { status: 202 },
      );
    }

    await eraseParentData(parent.id);
    await db.from('deletion_requests').update({ status: 'completed' }).eq('id', request.id);

    return Response.json({ requestId: request.id, status: 'completed' }, { status: 202 });
  } catch (err) {
    return jsonError(err);
  }
}
