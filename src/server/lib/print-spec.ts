/**
 * The physical book, as numbers.
 *
 * Everything that has to agree with a printer lives here: trim, bleed, safe
 * area, gutter, the page plan, and the resolution floor. The RFQ, the interior
 * PDF, the casewrap and the preflight report all read these constants, so the
 * spec a printer quotes against and the file we send them cannot drift apart.
 *
 * Units are PostScript points (1/72in) unless a name says otherwise, because
 * that is what pdf-lib draws in.
 */
export const PT_PER_INCH = 72;
export const inches = (n: number): number => n * PT_PER_INCH;

/** Finished page size after the printer cuts. 8×8in square picture book. */
export const TRIM = inches(8);

/**
 * Ink must run past the cut line or a sliver of white paper shows along the
 * edge when the guillotine drifts. 0.125in is the standard allowance; the page
 * box is therefore larger than the finished book on every side.
 */
export const BLEED = inches(0.125);
export const PAGE = TRIM + BLEED * 2;

/**
 * Nothing that matters may sit within this distance of the cut. Text placed in
 * the margin survives a trim that lands a millimetre off; text placed at the
 * edge gets its descenders sliced.
 */
export const SAFE_MARGIN = inches(0.375);

/**
 * Extra inner margin. A casebound book does not open flat, so the strip beside
 * the spine curves away from the reader — text set to the same margin on both
 * sides looks off-centre and, near the middle of a thick book, disappears into
 * the binding.
 */
export const GUTTER = inches(0.25);

/**
 * Illustrated story pages. Fixed, because one physical spec means one spine
 * width, one casewrap template and one quote.
 */
export const STORY_PAGES = 12;

/**
 * The interior, in order. Front and end matter are what make the block a book
 * rather than a stack of pictures, and the count is what the printer builds the
 * case around — so the plan is data, not something each renderer decides.
 *
 * A hardcover signature is folded and sewn in multiples of four, so the total
 * has to stay a multiple of four: 20 = 4 front + 12 story + 4 end.
 */
export type InteriorPageKind =
  | 'half_title'
  | 'title'
  | 'copyright'
  | 'dedication'
  | 'story'
  | 'the_end'
  | 'about'
  | 'blank';

export const INTERIOR_PLAN: InteriorPageKind[] = [
  'half_title',
  'title',
  'copyright',
  'dedication',
  ...(Array.from({ length: STORY_PAGES }, () => 'story') as InteriorPageKind[]),
  'the_end',
  'about',
  'blank',
  'blank',
];

export const INTERIOR_PAGES = INTERIOR_PLAN.length; // 20

/**
 * Resolution at the size the image is actually placed, not the size it was
 * generated at. Below the floor, printed artwork goes visibly soft; the target
 * is where it stops being a judgement call.
 */
export const PPI_FLOOR = 250;
export const PPI_TARGET = 300;

/** Pixels needed to place an image across `widthPt` at a given resolution. */
export function minPixelsFor(widthPt: number, ppi: number = PPI_TARGET): number {
  return Math.ceil((widthPt / PT_PER_INCH) * ppi);
}

/** Effective resolution of a `widthPx` image placed across `widthPt`. */
export function effectivePpi(widthPx: number, widthPt: number): number {
  if (widthPt <= 0) return 0;
  return widthPx / (widthPt / PT_PER_INCH);
}

/**
 * A full-bleed illustration covers the whole page box, so it is the largest
 * placement in the book and sets the resolution requirement for everything.
 */
export const FULL_BLEED_TARGET_PX = minPixelsFor(PAGE, PPI_TARGET); // 2475
export const FULL_BLEED_FLOOR_PX = minPixelsFor(PAGE, PPI_FLOOR); // 2063

/**
 * Spine width. The printer owns this formula — board and paper caliper vary by
 * stock — so these are placeholders until the chosen vendor's template arrives,
 * and `casewrapSpec` takes them as input rather than assuming them.
 */
export interface CasewrapParams {
  /** Thickness of one interior sheet, in points. */
  paperCaliper: number;
  /** Thickness of one cover board, in points. */
  boardCaliper: number;
  /** How far the printed sheet wraps around the board edge before folding in. */
  turnIn: number;
  /** Gap between board and spine that lets the cover hinge open. */
  hingeGap: number;
}

/** Placeholder stock: 150gsm matte text, 2.5mm greyboard. Replace per quote. */
export const DEFAULT_CASEWRAP_PARAMS: CasewrapParams = {
  paperCaliper: inches(0.0055),
  boardCaliper: inches(0.098),
  turnIn: inches(0.625),
  hingeGap: inches(0.3125),
};

export interface CasewrapSpec {
  /** Full flat sheet the printer prints the case on, including turn-ins. */
  sheetWidth: number;
  sheetHeight: number;
  spineWidth: number;
  /** X offset where the spine panel begins on the flat sheet. */
  spineX: number;
  /** Board panels are slightly larger than the trim — the cover overhangs. */
  boardWidth: number;
  boardHeight: number;
  params: CasewrapParams;
}

/**
 * Flat casewrap geometry for a given page count. Two boards plus the spine plus
 * two hinge gaps, then a turn-in on every side.
 */
export function casewrapSpec(
  interiorPages: number = INTERIOR_PAGES,
  params: CasewrapParams = DEFAULT_CASEWRAP_PARAMS,
): CasewrapSpec {
  // Sheets, not pages: a leaf is printed on both sides.
  const sheets = Math.ceil(interiorPages / 2);
  const spineWidth = sheets * params.paperCaliper + params.boardCaliper * 2;
  // The case overhangs the block by ~3mm so the pages sit protected inside it.
  const overhang = inches(0.125);
  const boardWidth = TRIM + overhang;
  const boardHeight = TRIM + overhang * 2;
  const sheetWidth = boardWidth * 2 + spineWidth + params.hingeGap * 2 + params.turnIn * 2;
  const sheetHeight = boardHeight + params.turnIn * 2;
  return {
    sheetWidth,
    sheetHeight,
    spineWidth,
    spineX: params.turnIn + boardWidth + params.hingeGap,
    boardWidth,
    boardHeight,
    params,
  };
}

/** Human-readable spec block for the RFQ and the preflight report header. */
export function specSummary(): string {
  const c = casewrapSpec();
  const f = (pt: number) => `${(pt / PT_PER_INCH).toFixed(3)}in`;
  return [
    `Trim: ${f(TRIM)} × ${f(TRIM)} square`,
    `Bleed: ${f(BLEED)} on all four sides (page box ${f(PAGE)} × ${f(PAGE)})`,
    `Safe area: ${f(SAFE_MARGIN)} from trim; additional ${f(GUTTER)} gutter at the spine`,
    `Interior: ${INTERIOR_PAGES} pages (${STORY_PAGES} illustrated story pages + front/end matter)`,
    `Binding: casebound hardcover, matte lamination`,
    `Casewrap flat sheet: ${f(c.sheetWidth)} × ${f(c.sheetHeight)}, spine ${f(c.spineWidth)}`,
    `Images: ${PPI_TARGET} PPI target, ${PPI_FLOOR} PPI minimum at placed size`,
    `Colour: sRGB IEC61966-2.1 supplied; convert to press profile on your side`,
  ].join('\n');
}
