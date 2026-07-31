import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { COLORS } from './brand';
import {
  BLEED,
  GUTTER,
  INTERIOR_PLAN,
  PAGE,
  PPI_FLOOR,
  SAFE_MARGIN,
  TRIM,
  effectivePpi,
  type InteriorPageKind,
} from './print-spec';
import { pdfSafe } from './text';

/**
 * The print master: the file a printer actually receives.
 *
 * Kept separate from `pdf.ts` (the on-screen digital copy) because the two want
 * opposite things. A screen PDF can letterbox an illustration and use whatever
 * font the reader has; a press file must run its ink past the cut line, carry
 * its own outlines, declare which page area gets trimmed away, and say what its
 * colours mean. Sharing one renderer between them is how a book comes back with
 * white edges set in Arial.
 *
 * Geometry lives in `print-spec.ts`, so the numbers here are the same ones the
 * printer was quoted.
 */
const FONT_DIR = path.join(process.cwd(), 'src/server/assets/fonts');

/** Where the trim sits inside the oversized page box. */
const TRIM_X = BLEED;
const TRIM_Y = BLEED;

export interface PrintPage {
  text: string;
  image: Buffer;
}

export interface PrintBookInput {
  title: string;
  coverImage: Buffer;
  pages: PrintPage[];
  /** Printed on its own page in the front matter. */
  dedication?: string | null;
  /** "Book N in {heroName}'s MoonBell Adventures", on the closing page. */
  series?: { number: number; heroName: string } | null;
  /** Stamped into the imprint page so a physical copy can be traced back. */
  bookId: string;
  year?: number;
}

export interface PrintBookResult {
  pdf: Buffer;
  /** Lowest effective resolution of any placed image, for the preflight record. */
  lowestPpi: number;
  pageCount: number;
}

interface Faces {
  display: PDFFont;
  body: PDFFont;
  bodyBold: PDFFont;
}

/**
 * Build the interior block. Returns the lowest placed resolution alongside the
 * bytes so the caller can refuse to release a book that would print soft — the
 * check belongs with the placement, which is the only place that knows how big
 * each image ended up.
 */
export async function buildPrintInterior(input: PrintBookInput): Promise<PrintBookResult> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const faces: Faces = {
    display: await doc.embedFont(await readFile(path.join(FONT_DIR, 'PlayfairDisplay-Bold.ttf')), { subset: true }),
    body: await doc.embedFont(await readFile(path.join(FONT_DIR, 'Nunito-Regular.ttf')), { subset: true }),
    bodyBold: await doc.embedFont(await readFile(path.join(FONT_DIR, 'Nunito-SemiBold.ttf')), { subset: true }),
  };

  const year = input.year ?? new Date().getUTCFullYear();
  let lowestPpi = Infinity;
  let storyIndex = 0;

  // The cover is its own leaf: it is the printed case, not part of the block.
  const cover = addPage(doc);
  lowestPpi = Math.min(lowestPpi, await drawFullBleed(doc, cover, input.coverImage));
  drawCoverTitle(cover, faces, input.title);

  for (const kind of INTERIOR_PLAN) {
    const page = addPage(doc);
    paintBg(page);
    // Odd leaves are right-hand pages, so their gutter is on the left.
    const recto = doc.getPageCount() % 2 === 0;

    switch (kind) {
      case 'half_title':
        drawCentred(page, faces.display, pdfSafe(input.title), 26, TRIM_Y + TRIM * 0.62, COLORS.ink);
        break;
      case 'title':
        drawTitlePage(page, faces, input.title, year);
        break;
      case 'copyright':
        drawImprint(page, faces, input, year, recto);
        break;
      case 'dedication':
        if (input.dedication?.trim()) {
          drawDedication(page, faces, input.dedication.trim());
        }
        break;
      case 'story': {
        const story = input.pages[storyIndex];
        storyIndex += 1;
        if (!story) break;
        lowestPpi = Math.min(lowestPpi, await drawFullBleed(doc, page, story.image));
        drawStoryText(page, faces, pdfSafe(story.text), recto);
        break;
      }
      case 'the_end':
        drawCentred(page, faces.display, 'The End', 34, TRIM_Y + TRIM * 0.55, COLORS.ink);
        if (input.series) {
          const line = pdfSafe(`Book ${input.series.number} in ${input.series.heroName}'s MoonBell Adventures`);
          drawWrapped(page, faces.body, line, 14, TRIM_Y + TRIM * 0.45, COLORS.inkSoft, TRIM - SAFE_MARGIN * 2);
        }
        break;
      case 'about':
        drawAbout(page, faces);
        break;
      case 'blank':
        break;
    }
  }

  setMetadata(doc, input);
  declareSrgbIntent(doc);

  return {
    pdf: Buffer.from(await doc.save()),
    lowestPpi: Number.isFinite(lowestPpi) ? Math.round(lowestPpi) : 0,
    pageCount: doc.getPageCount(),
  };
}

/**
 * Every page is the trim plus bleed on all four sides, and says so: TrimBox is
 * where the guillotine lands, BleedBox is how far the ink is allowed to run.
 * Without those boxes a printer has to guess which part of the sheet is the book.
 */
function addPage(doc: PDFDocument): PDFPage {
  const page = doc.addPage([PAGE, PAGE]);
  page.node.set(PDFName.of('TrimBox'), doc.context.obj([TRIM_X, TRIM_Y, TRIM_X + TRIM, TRIM_Y + TRIM]));
  page.node.set(PDFName.of('BleedBox'), doc.context.obj([0, 0, PAGE, PAGE]));
  page.node.set(PDFName.of('ArtBox'), doc.context.obj([TRIM_X, TRIM_Y, TRIM_X + TRIM, TRIM_Y + TRIM]));
  return page;
}

function paintBg(page: PDFPage): void {
  page.drawRectangle({ x: 0, y: 0, width: PAGE, height: PAGE, color: hex(COLORS.bg) });
}

/**
 * Cover the whole page box, cropping whatever overflows. `pdf.ts` fits images
 * inside their box, which on paper leaves a band of background along the trimmed
 * edge — the exact defect bleed exists to prevent.
 */
async function drawFullBleed(doc: PDFDocument, page: PDFPage, bytes: Buffer): Promise<number> {
  const img = await embed(doc, bytes);
  const scale = Math.max(PAGE / img.width, PAGE / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: (PAGE - w) / 2, y: (PAGE - h) / 2, width: w, height: h });
  return effectivePpi(img.width, w);
}

function drawCoverTitle(page: PDFPage, faces: Faces, title: string): void {
  const maxWidth = TRIM - SAFE_MARGIN * 2;
  const lines = wrap(pdfSafe(title), faces.display, 30, maxWidth);
  const plateH = lines.length * 38 + 34;
  const plateY = TRIM_Y + SAFE_MARGIN;
  page.drawRectangle({
    x: TRIM_X + SAFE_MARGIN,
    y: plateY,
    width: maxWidth,
    height: plateH,
    color: rgb(0.14, 0.13, 0.25),
    opacity: 0.82,
  });
  lines.forEach((line, i) => {
    const w = faces.display.widthOfTextAtSize(line, 30);
    page.drawText(line, {
      x: (PAGE - w) / 2,
      y: plateY + plateH - 42 - i * 38,
      size: 30,
      font: faces.display,
      color: rgb(1, 1, 1),
    });
  });
}

function drawTitlePage(page: PDFPage, faces: Faces, title: string, year: number): void {
  drawWrapped(page, faces.display, pdfSafe(title), 30, TRIM_Y + TRIM * 0.6, COLORS.ink, TRIM - SAFE_MARGIN * 2);
  drawCentred(page, faces.body, 'A MoonBell storybook', 13, TRIM_Y + TRIM * 0.44, COLORS.inkSoft);
  drawCentred(page, faces.bodyBold, `MoonBell · ${year}`, 12, TRIM_Y + SAFE_MARGIN + 10, COLORS.inkSoft);
}

/**
 * The imprint page. A printed book with no copyright line and no way to identify
 * which order produced it is a support problem waiting to happen — a parent
 * holding a misprint can read the id off the page.
 */
function drawImprint(page: PDFPage, faces: Faces, input: PrintBookInput, year: number, recto: boolean): void {
  const x = textLeft(recto);
  const width = textWidth();
  let y = TRIM_Y + TRIM * 0.42;
  const lines = [
    `Copyright © ${year} MoonBell.`,
    'This is a one-of-a-kind book, personalised for one child and printed to order.',
    'The story and illustrations were generated with AI and reviewed by a person before printing.',
    'Not for resale. All rights reserved.',
    `Edition reference: ${input.bookId}`,
  ];
  for (const line of lines) {
    for (const l of wrap(pdfSafe(line), faces.body, 9.5, width)) {
      page.drawText(l, { x, y, size: 9.5, font: faces.body, color: hex(COLORS.inkSoft) });
      y -= 14;
    }
    y -= 6;
  }
}

function drawDedication(page: PDFPage, faces: Faces, dedication: string): void {
  drawWrapped(page, faces.bodyBold, pdfSafe(dedication), 16, TRIM_Y + TRIM * 0.55, COLORS.ink, TRIM - SAFE_MARGIN * 4);
}

function drawAbout(page: PDFPage, faces: Faces): void {
  drawCentred(page, faces.display, 'MoonBell', 24, TRIM_Y + TRIM * 0.58, COLORS.ink);
  drawWrapped(
    page,
    faces.body,
    'Personalised storybooks, made one at a time in India. Every book is checked by a person before it is printed.',
    12,
    TRIM_Y + TRIM * 0.48,
    COLORS.inkSoft,
    TRIM - SAFE_MARGIN * 3,
  );
  drawCentred(page, faces.body, 'moonbell.in', 11, TRIM_Y + SAFE_MARGIN + 10, COLORS.inkSoft);
}

/**
 * Story text sits on a plate inside the safe area, shifted away from the spine.
 * A casebound book does not open flat, so text set to an even margin disappears
 * into the binding on the inner edge.
 */
function drawStoryText(page: PDFPage, faces: Faces, text: string, recto: boolean): void {
  const width = textWidth();
  const x = textLeft(recto);
  const { lines, size, lineHeight } = fitText(text, faces.body, width - 28, TRIM * 0.26);
  const plateH = lines.length * lineHeight + 28;
  page.drawRectangle({
    x,
    y: TRIM_Y + SAFE_MARGIN,
    width,
    height: plateH,
    color: hex(COLORS.surface),
    opacity: 0.95,
  });
  lines.forEach((line, i) => {
    const w = faces.body.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: x + (width - w) / 2,
      y: TRIM_Y + SAFE_MARGIN + plateH - 16 - size - i * lineHeight,
      size,
      font: faces.body,
      color: hex(COLORS.ink),
    });
  });
}

/** Usable text width: trim less the safe margin on both sides, less the gutter. */
function textWidth(): number {
  return TRIM - SAFE_MARGIN * 2 - GUTTER;
}

/** Left edge of the text block, pushed inward on whichever side the spine is. */
function textLeft(recto: boolean): number {
  return TRIM_X + SAFE_MARGIN + (recto ? GUTTER : 0);
}

function drawCentred(page: PDFPage, font: PDFFont, text: string, size: number, y: number, color: string): void {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE - w) / 2, y, size, font, color: hex(color) });
}

function drawWrapped(page: PDFPage, font: PDFFont, text: string, size: number, top: number, color: string, maxWidth: number): void {
  const lines = wrap(text, font, size, maxWidth);
  lines.forEach((line, i) => {
    const w = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: (PAGE - w) / 2, y: top - i * size * 1.45, size, font, color: hex(color) });
  });
}

/**
 * Tell the printer what our colours mean. Without an output intent the RIP has
 * to assume a source profile, and "assume" is how a warm cream page arrives grey.
 * We supply sRGB and let the printer convert to their own press profile, which
 * is what a short-run digital press wants anyway.
 */
function declareSrgbIntent(doc: PDFDocument): void {
  const intent = doc.context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFA1'),
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    RegistryName: PDFString.of('http://www.color.org'),
  });
  doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([intent]));
}

function setMetadata(doc: PDFDocument, input: PrintBookInput): void {
  doc.setTitle(`${pdfSafe(input.title)} — MoonBell print master`);
  doc.setAuthor('MoonBell');
  doc.setSubject(`Print master for book ${input.bookId}`);
  doc.setProducer('MoonBell print pipeline');
  doc.setCreator('MoonBell');
  doc.catalog.set(PDFName.of('Version'), PDFName.of('1.7'));
  // Spreads, so a reviewer sees the book the way it will be bound.
  doc.catalog.set(PDFName.of('PageLayout'), PDFName.of('TwoPageRight'));
}

async function embed(doc: PDFDocument, bytes: Buffer): Promise<PDFImage> {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return doc.embedPng(bytes);
  return doc.embedJpg(bytes);
}

interface FittedText {
  lines: string[];
  size: number;
  lineHeight: number;
}

function fitText(text: string, font: PDFFont, maxWidth: number, maxHeight: number): FittedText {
  const sizes = [17, 16, 15, 14, 13, 12, 11];
  for (const size of sizes) {
    const lineHeight = Math.round(size * 1.4);
    const lines = wrap(text, font, size, maxWidth);
    if (lines.length * lineHeight + 28 <= maxHeight) return { lines, size, lineHeight };
  }
  const size = sizes[sizes.length - 1];
  const lineHeight = Math.round(size * 1.4);
  const maxLines = Math.max(1, Math.floor((maxHeight - 28) / lineHeight));
  const lines = wrap(text, font, size, maxWidth).slice(0, maxLines);
  lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[\s.,;:]+$/, '')}…`;
  return { lines, size, lineHeight };
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function hex(h: string) {
  const n = h.replace('#', '');
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}

/** Kinds that carry an illustration — used by the RFQ generator and tests. */
export const ILLUSTRATED_KINDS: InteriorPageKind[] = ['story'];
export { PPI_FLOOR };
