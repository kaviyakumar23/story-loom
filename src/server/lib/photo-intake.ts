import { resolveGeminiBackend } from '../providers/gemini-transport';
import { serviceClient } from './supabase';

/**
 * The ONLY module with access to raw child-photo bytes. Photos live in a private
 * bucket that is deliberately separate from the product `assets` bucket, and are
 * never signed or served — they exist only long enough to be moderated and to
 * seed one stylized character-sheet call, then they're deleted.
 *
 * Egress is allowlisted: a photo may reach the image model ONLY over the Vertex
 * backend (its GCP terms give a stronger no-training posture), and nothing else
 * in the codebase can reach these bytes because every path goes through here.
 */
const BUCKET = 'photo-intake';

/** Storage key (within the intake bucket) for a parent's ephemeral upload. */
export function photoKey(parentId: string, uploadId: string): string {
  return `${parentId}/${uploadId}.jpg`;
}

export async function putPhoto(key: string, bytes: Buffer, mime: string): Promise<void> {
  const { error } = await serviceClient().storage.from(BUCKET).upload(key, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Photo intake upload failed: ${error.message}`);
}

/** Download raw photo bytes. Only the single pipeline egress path should call this. */
export async function getPhoto(key: string): Promise<Buffer | null> {
  const { data, error } = await serviceClient().storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Delete photo objects. Throws on failure so a stranded photo is retried, not lost. */
export async function removePhotos(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const client = serviceClient();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const { error } = await client.storage.from(BUCKET).remove(chunk);
    if (error) throw new Error(`Photo intake purge failed for ${chunk.length} object(s): ${error.message}`);
  }
}

/** List every object under the intake bucket (for the orphan-sweep purge). */
export async function listAllPhotoKeys(): Promise<{ key: string; createdAt: string | null }[]> {
  const client = serviceClient();
  const out: { key: string; createdAt: string | null }[] = [];
  // Objects are nested one folder deep: {parentId}/{uploadId}.jpg
  const { data: folders } = await client.storage.from(BUCKET).list('', { limit: 1000 });
  for (const folder of folders ?? []) {
    if (!folder.name) continue;
    const { data: files } = await client.storage.from(BUCKET).list(folder.name, { limit: 1000 });
    for (const f of files ?? []) {
      if (f.name) out.push({ key: `${folder.name}/${f.name}`, createdAt: f.created_at ?? null });
    }
  }
  return out;
}

/**
 * Hard egress allowlist. A child photo may only be sent to the image model over
 * Vertex; the moderation pre-check (OpenAI, on our side) is the other allowed
 * destination. Any other destination — or a misconfigured non-Vertex backend —
 * throws, so the feature fails CLOSED instead of leaking.
 */
export function assertPhotoEgressAllowed(destination: 'character_sheet' | 'moderation'): void {
  if (destination === 'moderation') return;
  if (destination === 'character_sheet') {
    if (resolveGeminiBackend() !== 'vertex') {
      throw new Error('Refusing to egress a child photo: the image backend is not Vertex (photos never use the AI-Studio key path).');
    }
    return;
  }
  throw new Error(`Refusing to egress a child photo to an unknown destination: ${destination}`);
}
