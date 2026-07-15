import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, internal } from '@/server/lib/errors';
import { eraseParentData } from '@/server/lib/erasure';
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
    await eraseParentData(parent.id);

    return Response.json({ requestId: request.id, status: 'completed' }, { status: 202 });
  } catch (err) {
    return jsonError(err);
  }
}
