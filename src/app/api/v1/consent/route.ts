import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import type { CreateConsentResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  consentVersion: z.string().min(1),
  method: z.enum(['explicit_checkbox', 'adult_payment_signal', 'digilocker']),
});

// ---- POST /api/v1/consent — verifiable parental consent (§9) ----
export async function POST(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid consent payload', parsed.error.issues);

    const { data, error } = await serviceClient()
      .from('consent_records')
      .insert({
        parent_id: parent.id,
        method: parsed.data.method,
        consent_version: parsed.data.consentVersion,
        ip_country: req.headers.get('x-vercel-ip-country'),
      })
      .select('id')
      .single();
    if (error || !data) throw badRequest('Could not record consent', error?.message);

    await audit({ actor: 'parent', action: 'consent.recorded', entity: 'consent_records', entityId: data.id, metadata: { method: parsed.data.method, version: parsed.data.consentVersion } });
    return Response.json({ consentId: data.id } satisfies CreateConsentResponse, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
