import sharp from 'sharp';

/**
 * In-memory sanitisation for an uploaded child photo. Pure bytes-in/bytes-out —
 * no storage, no network — so it can be exercised against REAL images in tests
 * while the upload route stays cheap to test with sharp stubbed.
 */
export const MAX_PHOTO_DIM = 1024;

/**
 * Identify the container by magic bytes, never by the declared MIME type or
 * file extension — both are attacker-controlled.
 */
export function sniffImage(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Re-encode: normalises to JPEG, applies EXIF orientation then strips ALL
 * metadata (including GPS), and bounds the dimensions — neutralising container
 * tricks before the bytes are ever moderated or egressed. Returns null when the
 * bytes don't decode as an image.
 */
export async function sanitizePhoto(raw: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(raw)
      .rotate()
      .resize(MAX_PHOTO_DIM, MAX_PHOTO_DIM, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return null;
  }
}
