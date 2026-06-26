import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/account/export — DPDP access right (§9) ----
export async function GET(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const db = serviceClient();

    const [profile, consents, heroes, books, orders] = await Promise.all([
      db.from('profiles').select('*').eq('id', parent.id).maybeSingle(),
      db.from('consent_records').select('*').eq('parent_id', parent.id),
      db.from('heroes').select('*').eq('parent_id', parent.id),
      db.from('books').select('*').eq('parent_id', parent.id),
      db.from('orders').select('*').eq('parent_id', parent.id),
    ]);

    await audit({ actor: 'parent', action: 'account.exported', entity: 'profiles', entityId: parent.id });

    return Response.json({
      exportedAt: new Date().toISOString(),
      profile: profile.data ?? null,
      consentRecords: consents.data ?? [],
      heroes: heroes.data ?? [],
      books: books.data ?? [],
      orders: orders.data ?? [],
    });
  } catch (err) {
    return jsonError(err);
  }
}
