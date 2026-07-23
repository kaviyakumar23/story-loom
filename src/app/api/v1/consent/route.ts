import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, internal } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import type { CreateConsentResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  consentVersion: z.string().min(1),
  method: z.enum(['explicit_checkbox', 'adult_payment_signal', 'digilocker']),
  // Which processing this consent authorizes. Omitted → the DB default
  // ('book_creation'). A distinct scope (e.g. 'photo_likeness') is granted and
  // withdrawn independently.
  scope: z.string().min(1).max(40).optional(),
});

// ---- POST /api/v1/consent — verifiable parental consent (§9) ----
export async function POST(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid consent payload', parsed.error.issues);

    // Only reference the `scope` column when a caller explicitly sets one, so
    // this route works both before and after the scope migration lands; the DB
    // default fills in 'book_creation' otherwise.
    const row: Record<string, unknown> = {
      parent_id: parent.id,
      method: parsed.data.method,
      consent_version: parsed.data.consentVersion,
      ip_country: req.headers.get('x-vercel-ip-country'),
    };
    if (parsed.data.scope) row.scope = parsed.data.scope;

    const { data, error } = await serviceClient()
      .from('consent_records')
      .insert(row)
      .select('id')
      .single();
    if (error || !data) throw internal('Could not record consent', error?.message);

    await audit({ actor: 'parent', action: 'consent.recorded', entity: 'consent_records', entityId: data.id, metadata: { method: parsed.data.method, version: parsed.data.consentVersion, scope: parsed.data.scope ?? 'book_creation' } });
    return Response.json({ consentId: data.id } satisfies CreateConsentResponse, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

// ---- DELETE /api/v1/consent — withdraw consent (DPDP §6(4)-(6)) ----
//
// Withdrawal must be as easy as granting, so it is one call with no arguments:
// every live consent for this parent is withdrawn. Processing stops going
// forward — POST /books refuses a withdrawn consent — while books already
// generated stay put; removing those is erasure (POST /account/delete), which
// is a separate right the parent may not want to exercise.
export async function DELETE(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const withdrawnAt = new Date().toISOString();
    // Optional ?scope= withdraws only that scope; no scope → withdraws all live
    // consents (the easy-as-granting default). Only filter on the column when a
    // scope is asked for, so this works before the scope migration lands.
    const scope = new URL(req.url).searchParams.get('scope');

    let query = serviceClient()
      .from('consent_records')
      .update({ withdrawn_at: withdrawnAt })
      .eq('parent_id', parent.id)
      .is('withdrawn_at', null);
    if (scope) query = query.eq('scope', scope);

    const { data, error } = await query.select('id');
    if (error) throw internal('Could not withdraw consent', error.message);

    const ids = (data ?? []).map((row) => (row as { id: string }).id);
    for (const id of ids) {
      await audit({ actor: 'parent', action: 'consent.withdrawn', entity: 'consent_records', entityId: id, metadata: scope ? { scope } : undefined });
    }
    return Response.json({ withdrawn: ids.length, withdrawnAt });
  } catch (err) {
    return jsonError(err);
  }
}
