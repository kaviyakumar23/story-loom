import { serviceClient } from './supabase';

/**
 * Asset storage (§11) on Supabase Storage (private `assets` bucket). We store
 * only the storage KEY in the DB — never a public URL — and issue short-lived
 * signed URLs on demand, owner-scoped. (Cloudflare R2 can be swapped in later
 * behind this same interface for egress-free delivery at volume.)
 */
const BUCKET = 'assets';
const DEFAULT_TTL_SECONDS = 60 * 10; // 10 minutes

export async function signAsset(
  storageKey: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await serviceClient()
    .storage.from(BUCKET)
    .createSignedUrl(storageKey, ttlSeconds);
  return error || !data ? null : data.signedUrl;
}

/** Upload bytes under a namespaced key (§11). `upsert` keeps stage re-runs idempotent. */
export async function uploadAsset(
  storageKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await serviceClient()
    .storage.from(BUCKET)
    .upload(storageKey, body, { contentType, upsert: true });
  if (error) throw new Error(`Asset upload failed for ${storageKey}: ${error.message}`);
}

/** Download an object as a Buffer (e.g. to re-load a cached reference image). */
export async function downloadAsset(storageKey: string): Promise<Buffer | null> {
  const { data, error } = await serviceClient().storage.from(BUCKET).download(storageKey);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Delete objects from storage (erasure + retention purges, §9/§11). Chunked, and
 * it THROWS on failure.
 *
 * Both callers delete the rows holding these keys immediately afterwards, and
 * those rows are the only index of them. Swallowing a failure here would strand
 * a child's likeness in the bucket — unfindable, and so undeletable forever.
 * Failing loudly lets erasure be retried instead.
 */
export async function removeAssets(storageKeys: string[]): Promise<void> {
  if (!storageKeys.length) return;
  const client = serviceClient();
  for (let i = 0; i < storageKeys.length; i += 100) {
    const chunk = storageKeys.slice(i, i + 100);
    const { error } = await client.storage.from(BUCKET).remove(chunk);
    if (error) {
      throw new Error(`Storage purge failed for ${chunk.length} object(s): ${error.message}`);
    }
  }
}
