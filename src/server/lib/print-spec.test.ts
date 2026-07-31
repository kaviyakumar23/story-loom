import { describe, expect, it } from 'vitest';
import {
  BLEED,
  FULL_BLEED_FLOOR_PX,
  INTERIOR_PAGES,
  INTERIOR_PLAN,
  PAGE,
  PPI_FLOOR,
  STORY_PAGES,
  TRIM,
  casewrapSpec,
  effectivePpi,
  inches,
  minPixelsFor,
} from './print-spec';

describe('print spec', () => {
  it('is an 8in square trim with a 0.125in bleed on every side', () => {
    expect(TRIM).toBe(576);
    expect(BLEED).toBe(9);
    expect(PAGE).toBe(594);
  });

  // A casebound signature is folded in multiples of four; an off-count means the
  // printer either adds blank leaves or refuses the job.
  it('plans an interior page count divisible by four', () => {
    expect(INTERIOR_PAGES).toBe(20);
    expect(INTERIOR_PAGES % 4).toBe(0);
    expect(INTERIOR_PLAN.filter((p) => p === 'story')).toHaveLength(STORY_PAGES);
  });

  it('puts the front matter before the story and the end matter after it', () => {
    const firstStory = INTERIOR_PLAN.indexOf('story');
    const lastStory = INTERIOR_PLAN.lastIndexOf('story');
    expect(INTERIOR_PLAN.slice(0, firstStory)).toEqual(['half_title', 'title', 'copyright', 'dedication']);
    expect(INTERIOR_PLAN.slice(lastStory + 1)).toEqual(['the_end', 'about', 'blank', 'blank']);
  });

  it('requires ~2475px across a full-bleed page for 300 PPI', () => {
    expect(minPixelsFor(PAGE)).toBe(2475);
    expect(FULL_BLEED_FLOOR_PX).toBe(minPixelsFor(PAGE, PPI_FLOOR));
  });

  // The number the floor is checked against: a 1024px render placed across the
  // whole page lands near 124 PPI, which is half of what print needs.
  it('measures resolution at the placed size, not the generated size', () => {
    expect(Math.round(effectivePpi(1024, PAGE))).toBe(124);
    expect(Math.round(effectivePpi(2475, PAGE))).toBe(300);
  });

  it('grows the spine with the page count', () => {
    const thin = casewrapSpec(20);
    const thick = casewrapSpec(60);
    expect(thick.spineWidth).toBeGreaterThan(thin.spineWidth);
    // Both boards, the spine, two hinge gaps and two turn-ins make the sheet.
    const p = thin.params;
    expect(thin.sheetWidth).toBeCloseTo(thin.boardWidth * 2 + thin.spineWidth + p.hingeGap * 2 + p.turnIn * 2, 5);
  });

  it('overhangs the block so the case protects the pages', () => {
    const c = casewrapSpec();
    expect(c.boardWidth).toBeGreaterThan(TRIM);
    expect(c.boardHeight).toBeGreaterThan(TRIM);
  });

  it('converts inches to points', () => {
    expect(inches(1)).toBe(72);
    expect(inches(0.125)).toBe(9);
  });
});
