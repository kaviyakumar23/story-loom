import sharp from 'sharp';
import { FULL_BLEED_FLOOR_PX, FULL_BLEED_TARGET_PX } from './print-spec';

/**
 * Resolution is a print problem that is invisible until it is expensive.
 *
 * An illustration that fills a laptop window at 1024px lands near 124 PPI across
 * an 8.25in page — roughly half of what a press needs, and nobody notices until
 * a parent is holding it. Asking the model for a bigger image is the fix; this
 * module is the guarantee, because a model can quietly return whatever size it
 * likes and nothing upstream measures it.
 *
 * Two jobs: measure what we actually got, and raise anything short of the floor
 * before it reaches a print master.
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** Real pixel dimensions, read from the bytes rather than assumed. */
export async function measureImage(bytes: Buffer<ArrayBuffer>): Promise<ImageDimensions> {
  const meta = await sharp(bytes).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

export interface EnsuredImage {
  bytes: Buffer<ArrayBuffer>;
  width: number;
  height: number;
  /** True when we resampled, so the caller can record it against the book. */
  upscaled: boolean;
  originalWidth: number;
}

/**
 * Bring an illustration up to print resolution if the model returned less.
 *
 * Lanczos3 resampling does not invent detail — it makes a soft image bigger, not
 * sharper. For flat, painterly children's illustration that is an acceptable
 * trade (the alternative is visible pixel structure on paper), but it is a
 * backstop for a model that under-delivered, not a substitute for asking for the
 * right size. `upscaled` is returned so a run that leans on it is visible rather
 * than silent.
 */
export async function ensurePrintResolution(
  bytes: Buffer<ArrayBuffer>,
  targetPx: number = FULL_BLEED_TARGET_PX,
  floorPx: number = FULL_BLEED_FLOOR_PX,
): Promise<EnsuredImage> {
  const { width, height } = await measureImage(bytes);
  if (width === 0 || height === 0) {
    throw new Error('Could not read the illustration dimensions — refusing to place it in a print master.');
  }
  if (width >= floorPx && height >= floorPx) {
    return { bytes, width, height, upscaled: false, originalWidth: width };
  }

  const scale = targetPx / Math.min(width, height);
  const out = await sharp(bytes)
    .resize({
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      kernel: 'lanczos3',
      fit: 'fill',
    })
    // PNG keeps the flat colour areas of illustrated art clean; a JPEG re-encode
    // at this size would add ringing along every line the upscale just softened.
    .png({ compressionLevel: 9 })
    .toBuffer();
  // sharp types its output as the generic Buffer; the bytes are a plain
  // ArrayBuffer, which is what every consumer here needs.
  const resampled = Buffer.from(out) as Buffer<ArrayBuffer>;
  const after = await measureImage(resampled);
  return { bytes: resampled, width: after.width, height: after.height, upscaled: true, originalWidth: width };
}
