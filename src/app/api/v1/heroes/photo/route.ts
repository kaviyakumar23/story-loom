import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { requireParent } from '@/server/auth';
import { loadEnv } from '@/server/config/env';
import { audit } from '@/server/lib/audit';
import { assertBetaAccess } from '@/server/lib/beta-access';
import { badRequest, forbidden, internal } from '@/server/lib/errors';
import { assertPhotoEgressAllowed, photoKey, putPhoto } from '@/server/lib/photo-intake';
import { assertRateLimit } from '@/server/lib/rate-limit';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { getProviders } from '@/server/providers/index';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIM = 1024;

// ---- POST /api/v1/heroes/photo — optional, consent-gated child photo intake ----
//
// A photo is EPHEMERAL: validated → magic-byte sniffed → re-encoded (strips EXIF/
// GPS) → moderated BEFORE it is ever stored → kept in the isolated intake bucket
// only until the pipeline consumes it into a stylized sheet, then deleted. A
// rejected photo is never stored (nothing to leak), and never shown to a human.
export async function POST(req: Request): Promise<Response> {
  try {
    if (loadEnv().NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED !== 'true') throw forbidden('Photo likeness is not enabled');
    const parent = await requireParent(req);
    assertBetaAccess(req);
    assertRateLimit(`photo:${parent.id}`, 3, 60 * 60_000); // 3 / hour

    const form = await req.formData().catch(() => null);
    const file = form?.get('photo');
    const consentId = form?.get('consentId');
    if (!(file instanceof Blob)) throw badRequest('No photo provided');
    if (typeof consentId !== 'string') throw badRequest('Missing photo consent');
    if (file.size > MAX_BYTES) throw badRequest('That image is too large — please use one under 8 MB.');

    // Consent must exist, be this parent's, be scoped to photo likeness, and stand.
    const db = serviceClient();
    const { data: consent } = await db
      .from('consent_records')
      .select('id, scope, withdrawn_at')
      .eq('id', consentId)
      .eq('parent_id', parent.id)
      .maybeSingle();
    const c = consent as { id: string; scope: string; withdrawn_at: string | null } | null;
    if (!c || c.scope !== 'photo_likeness' || c.withdrawn_at) {
      throw badRequest('Photo consent is missing or has been withdrawn.');
    }

    const raw = Buffer.from(await file.arrayBuffer());
    if (!sniffImage(raw)) throw badRequest('Please upload a JPEG, PNG, or WebP image.');

    // Re-encode: normalises to JPEG, applies EXIF orientation then strips ALL
    // metadata (including GPS), and bounds the dimensions — neutralising container
    // tricks before the bytes are ever moderated or egressed.
    let clean: Buffer;
    try {
      clean = await sharp(raw)
        .rotate()
        .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch {
      throw badRequest('We couldn’t read that image — please try a different photo.');
    }

    // Moderate BEFORE storing. On any block, nothing is stored and no human ever
    // sees it — the parent just falls back to attribute chips.
    assertPhotoEgressAllowed('moderation');
    const verdict = await getProviders().moderator.moderateImage({ base64: clean.toString('base64'), mime: 'image/jpeg' });
    if (!verdict.allowed) {
      await audit({ actor: 'system', action: 'photo.rejected', entity: 'profiles', entityId: parent.id, metadata: { reasons: verdict.reasons } });
      return Response.json({ error: { code: 'photo_rejected', message: 'That photo can’t be used. You can still build the character from the options instead.' } }, { status: 422 });
    }

    const uploadId = randomUUID();
    const key = photoKey(parent.id, uploadId);
    await putPhoto(key, clean, 'image/jpeg');
    const { data: row, error } = await db
      .from('photo_uploads')
      .insert({ parent_id: parent.id, consent_id: c.id, storage_key: key, status: 'approved', moderation: verdict.raw ?? null })
      .select('id')
      .single();
    if (error || !row) throw internal('Could not record the photo', error?.message);

    await audit({ actor: 'parent', action: 'photo.uploaded', entity: 'photo_uploads', entityId: (row as { id: string }).id });
    return Response.json({ photoUploadId: (row as { id: string }).id }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

function sniffImage(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
