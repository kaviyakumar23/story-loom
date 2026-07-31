import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildPrintInterior } from './print-pdf';
import { preflight, type PreflightReport } from './print-preflight';
import { FULL_BLEED_TARGET_PX, INTERIOR_PAGES, PPI_FLOOR, PPI_TARGET, STORY_PAGES } from './print-spec';

/**
 * Evidence for the print gate, asserted through the same preflight the founder
 * runs by hand and the pipeline runs before release.
 *
 * Everything checked here is invisible on screen and fatal on press: a page with
 * no bleed box trims to a white edge, an unembedded font is silently swapped by
 * the printer's RIP, and a 1024px render stretched across eight inches looks
 * fine on a laptop and soft in a child's hands.
 */
async function art(px: number): Promise<Buffer> {
  return sharp({ create: { width: px, height: px, channels: 3, background: { r: 90, g: 84, b: 198 } } })
    .png()
    .toBuffer();
}

const check = (r: PreflightReport, name: string) => r.checks.find((c) => c.name === name);

describe('print interior', () => {
  let report: PreflightReport;
  let lowestPpi: number;
  let pageCount: number;

  beforeAll(async () => {
    const image = await art(FULL_BLEED_TARGET_PX);
    const result = await buildPrintInterior({
      title: 'Aarav and the Star That Listens',
      coverImage: image,
      pages: Array.from({ length: STORY_PAGES }, (_, i) => ({
        text: `Page ${i + 1}. Aarav reached up on tiptoe and whispered to the little star.`,
        image,
      })),
      dedication: 'For Aarav, who is braver than he knows.',
      series: { number: 2, heroName: 'Aarav' },
      bookId: '11111111-1111-4111-8111-111111111111',
      year: 2026,
    });
    lowestPpi = result.lowestPpi;
    pageCount = result.pageCount;
    report = await preflight(result.pdf, 'interior');
  }, 120_000);

  it('passes every preflight check', () => {
    const failed = report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    expect(failed).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('is the cover leaf plus the planned 20-page interior', () => {
    expect(pageCount).toBe(INTERIOR_PAGES + 1);
    expect(check(report, 'page count')?.ok).toBe(true);
  });

  // Ink has to run past the cut line, and the file has to say where that line is,
  // or the printer is guessing which part of the sheet is the book.
  it('declares a trim box inside an oversized page on every page', () => {
    expect(check(report, 'page geometry')?.detail).toContain('8.250in square');
    expect(check(report, 'page geometry')?.detail).toContain('8.000in trim');
  });

  it('carries its own font outlines rather than naming standard fonts', () => {
    expect(report.fonts.length).toBeGreaterThan(0);
    expect(report.fonts.every((f) => f.embedded)).toBe(true);
    expect(report.fonts.map((f) => f.baseFont).join(' ')).not.toMatch(/Helvetica|Times-Roman/);
  });

  it('says what its colours mean', () => {
    expect(check(report, 'output intent')?.detail).toContain('sRGB');
  });

  it('names the file so it does not land unlabelled in a print queue', () => {
    expect(check(report, 'document title')?.detail).toContain('print master');
  });

  // Full-bleed placement is the largest in the book, so it sets the requirement.
  it('places artwork at the target resolution, measured where it lands', () => {
    expect(lowestPpi).toBeGreaterThanOrEqual(PPI_FLOOR);
    expect(report.lowestPpi).toBeGreaterThanOrEqual(PPI_TARGET - 1);
  });

  it('reports a placement that would print soft rather than shipping it quietly', async () => {
    const tiny = await art(1024);
    const result = await buildPrintInterior({
      title: 'Too Small',
      coverImage: tiny,
      pages: [{ text: 'One page.', image: tiny }],
      bookId: 'b1',
      year: 2026,
    });
    // 1024px across an 8.25in page is ~124 PPI — half of what print needs.
    expect(result.lowestPpi).toBeLessThan(PPI_FLOOR);
    expect(result.lowestPpi).toBeCloseTo(124, -1);

    const bad = await preflight(result.pdf, 'interior');
    expect(bad.ok).toBe(false);
    expect(check(bad, 'image resolution')?.ok).toBe(false);
  }, 60_000);
});
