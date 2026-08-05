import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { sanitizePhoto, sniffImage } from './photo-sanitize';

/**
 * REAL sharp — deliberately not the stubbed pipeline the route tests use.
 * These are the only tests that pin the actual sanitisation behaviour (EXIF/GPS
 * strip, orientation, bounding, JPEG normalisation) against real images, so the
 * privacy promise doesn't rest on a mock. Fixtures are built programmatically —
 * no binary files checked in.
 */

async function jpegWithExif(width: number, height: number, orientation?: number): Promise<Buffer> {
  const base = await sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 40, b: 40 } },
  })
    .jpeg()
    .toBuffer();
  // Write identifying EXIF into the file — this is what must NOT survive.
  return sharp(base)
    .withMetadata({
      ...(orientation ? { orientation } : {}),
      exif: { IFD0: { Copyright: 'sensitive-copyright', Artist: 'sensitive-artist', ImageDescription: 'sensitive-location-hint' } },
    })
    .jpeg()
    .toBuffer();
}

describe('sanitizePhoto (real sharp)', () => {
  it('strips ALL EXIF metadata from the output', async () => {
    const dirty = await jpegWithExif(64, 64);
    // Prove the fixture actually carried EXIF, so the assertion below means something.
    expect((await sharp(dirty).metadata()).exif).toBeDefined();

    const clean = await sanitizePhoto(dirty);
    expect(clean).not.toBeNull();
    const meta = await sharp(clean!).metadata();
    // No EXIF segment at all ⇒ no GPS, no serials, no timestamps, nothing.
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe('jpeg');
  });

  it('applies EXIF orientation, then discards the tag', async () => {
    // 100×50 tagged orientation 6 (rotate 90°): an honest render is 50×100.
    const rotated = await jpegWithExif(100, 50, 6);
    const clean = await sanitizePhoto(rotated);
    const meta = await sharp(clean!).metadata();
    expect([meta.width, meta.height]).toEqual([50, 100]);
    expect(meta.orientation).toBeUndefined(); // baked in, not carried along
  });

  it('bounds dimensions to 1024 without enlarging small images', async () => {
    const big = await jpegWithExif(2000, 1400);
    const bigClean = await sanitizePhoto(big);
    const bigMeta = await sharp(bigClean!).metadata();
    expect(Math.max(bigMeta.width!, bigMeta.height!)).toBeLessThanOrEqual(1024);

    const small = await jpegWithExif(64, 48);
    const smallMeta = await sharp((await sanitizePhoto(small))!).metadata();
    expect([smallMeta.width, smallMeta.height]).toEqual([64, 48]); // never upscaled
  });

  it('normalises PNG (and its metadata) to a clean JPEG', async () => {
    const png = await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 10, g: 120, b: 90, alpha: 1 } } })
      .png()
      .toBuffer();
    expect(sniffImage(png)).toBe('png');
    const clean = await sanitizePhoto(png);
    const meta = await sharp(clean!).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
  });

  it('returns null for bytes that are not an image', async () => {
    expect(await sanitizePhoto(Buffer.from('#!/bin/sh\necho not-an-image'))).toBeNull();
  });

  it('sniffs containers by magic bytes, not by anything declared', () => {
    expect(sniffImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]))).toBe('jpeg');
    expect(sniffImage(Buffer.from('GIF89a-not-allowed-here!'))).toBeNull();
    expect(sniffImage(Buffer.from('plain text pretending to be .png'))).toBeNull();
  });
});
