import { z } from 'zod';
import { addNewsletterContact } from '@/server/lib/email';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  source: z.string().trim().max(40).optional(),
});

// ---- POST /api/v1/newsletter — public newsletter signup ----
export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
    const { email, source } = parsed.data;

    // DB is the source of truth; upsert dedupes on the unique email.
    await serviceClient()
      .from('newsletter_subscribers')
      .upsert({ email, source: source ?? null }, { onConflict: 'email', ignoreDuplicates: true });

    // Best-effort mirror into the Resend audience (no-op if unconfigured).
    await addNewsletterContact(email).catch(() => {});

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
