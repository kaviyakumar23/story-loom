import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ensurePrintResolution, measureImage } from './image-resolution';
import { FULL_BLEED_FLOOR_PX, FULL_BLEED_TARGET_PX } from './print-spec';

/**
 * The resolution floor exists because nothing else in the system could tell a
 * print-ready render from one that would come off the press soft: the image
 * provider used to report hard-coded zero dimensions, so an under-sized page
 * would have been discovered by a parent holding the book.
 */
const png = async (w: number, h = w): Promise<Buffer> =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 90, g: 84, b: 198 } } }).png().toBuffer();

describe('print resolution floor', () => {
  it('reads real dimensions from the bytes', async () => {
    expect(await measureImage(await png(1234, 567))).toEqual({ width: 1234, height: 567 });
  });

  it('leaves an image that already clears the floor untouched', async () => {
    const bytes = await png(FULL_BLEED_TARGET_PX);
    const out = await ensurePrintResolution(bytes);
    expect(out.upscaled).toBe(false);
    expect(out.width).toBe(FULL_BLEED_TARGET_PX);
    expect(out.bytes.equals(bytes)).toBe(true); // same pixels, not resampled
  }, 30_000);

  // The cover and the first three pages are rendered during the FREE preview, at
  // preview size. Reused verbatim they would drag every print master under the
  // floor — so the fulfilment path raises them, and prints the artwork the
  // parent actually approved rather than re-rolling it.
  it('raises a preview-sized render so a reused page can still be printed', async () => {
    const out = await ensurePrintResolution(await png(1024));
    expect(out.upscaled).toBe(true);
    expect(out.width).toBeGreaterThanOrEqual(FULL_BLEED_FLOOR_PX);
  }, 30_000);

  // A 1024px render is what the models return unasked, and it is about half of
  // what an 8.25in page needs.
  it('raises an under-sized render to the target rather than passing it through', async () => {
    const out = await ensurePrintResolution(await png(1024));
    expect(out.upscaled).toBe(true);
    expect(out.originalWidth).toBe(1024);
    expect(out.width).toBeGreaterThanOrEqual(FULL_BLEED_TARGET_PX);
    expect(out.width).toBeGreaterThanOrEqual(FULL_BLEED_FLOOR_PX);
  }, 30_000);

  it('keeps the aspect ratio when it resamples', async () => {
    const out = await ensurePrintResolution(await png(800, 1000));
    expect(out.width / out.height).toBeCloseTo(0.8, 2);
  }, 30_000);

  it('refuses bytes it cannot measure rather than guessing', async () => {
    await expect(ensurePrintResolution(Buffer.from('not an image'))).rejects.toThrow();
  });
});
