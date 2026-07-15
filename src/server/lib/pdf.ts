import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from 'pdf-lib';
import { COLORS } from './brand';
import { pdfSafe } from './text';

/**
 * Print-quality PDF assembly (§6 step 10, §11) using pdf-lib — pure JS, no
 * headless browser, so it runs in a serverless function. The real hero name is
 * already injected locally into the page text before this point (§9).
 *
 * Square 8"×8" picture-book trim. Each interior page: illustration on top,
 * story text on a cream plate below. Standard fonts keep it dependency-free
 * (embedding the Baloo display font is a later enhancement).
 *
 * Illustrations arrive as BYTES, not URLs, and are non-optional: a book someone
 * paid for must never be assembled with a missing picture, so fetching and the
 * "is it there at all" decision live at the caller, and everything here throws
 * rather than quietly degrading.
 */
const PT = 72;
const SIZE = 8 * PT; // 576pt square
/** Illustration occupies the top ~68%; the text plate lives below it. */
const IMAGE_BOTTOM = SIZE * 0.32;
const PLATE_PAD = 14;

export interface AssemblePage {
  text: string;
  image: Buffer;
}
export interface AssembleInput {
  title: string;
  coverImage: Buffer;
  pages: AssemblePage[];
}

export async function assemblePdf(input: AssembleInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const display = await doc.embedFont(StandardFonts.HelveticaBold);

  // Cover
  const cover = doc.addPage([SIZE, SIZE]);
  paintBg(cover);
  drawContained(cover, await embed(doc, input.coverImage), 0, 0, SIZE, SIZE);
  const titleLines = wrap(pdfSafe(input.title), display, 30, SIZE - 96);
  const plateH = titleLines.length * 38 + 32;
  cover.drawRectangle({ x: 36, y: 40, width: SIZE - 72, height: plateH, color: rgb(0.23, 0.16, 0.13), opacity: 0.82 });
  titleLines.forEach((line, i) => {
    const w = display.widthOfTextAtSize(line, 30);
    cover.drawText(line, { x: (SIZE - w) / 2, y: 40 + plateH - 40 - i * 38, size: 30, font: display, color: rgb(1, 1, 1) });
  });

  // Interior pages
  for (const page of input.pages) {
    const p = doc.addPage([SIZE, SIZE]);
    paintBg(p);
    drawContained(p, await embed(doc, page.image), 0, IMAGE_BOTTOM, SIZE, SIZE - IMAGE_BOTTOM);

    // Fit the text to the plate. Page length is the model's choice, so a long
    // page must shrink (then, at the floor, truncate) instead of spilling out
    // over the illustration.
    const { lines, size, lineHeight } = fitText(pdfSafe(page.text), body, SIZE - 120, IMAGE_BOTTOM - 20);
    const ph = lines.length * lineHeight + PLATE_PAD * 2;
    p.drawRectangle({ x: 28, y: 28, width: SIZE - 56, height: ph, color: hex(COLORS.surface), borderColor: hex(COLORS.hairline), borderWidth: 1.5 });
    lines.forEach((line, i) => {
      const w = body.widthOfTextAtSize(line, size);
      p.drawText(line, { x: (SIZE - w) / 2, y: 28 + ph - PLATE_PAD - size - i * lineHeight, size, font: body, color: hex(COLORS.ink) });
    });
  }

  return Buffer.from(await doc.save());
}

function paintBg(page: { drawRectangle: (o: Record<string, unknown>) => void }) {
  page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: hex(COLORS.bg) });
}

/** Embed image bytes (PNG or JPEG, sniffed by signature). Throws if unusable. */
async function embed(doc: PDFDocument, bytes: Buffer): Promise<PDFImage> {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return doc.embedPng(bytes);
  return doc.embedJpg(bytes);
}

/** Draw an image "contained" (fit, centered) within a box — no overflow. */
function drawContained(
  page: { drawImage: (img: PDFImage, o: Record<string, unknown>) => void },
  img: PDFImage,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  const scale = Math.min(bw / img.width, bh / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: bx + (bw - w) / 2, y: by + (bh - h) / 2, width: w, height: h });
}

interface FittedText {
  lines: string[];
  size: number;
  lineHeight: number;
}

/** Largest size at which the text fits the plate; truncates at the floor. */
function fitText(text: string, font: PDFFont, maxWidth: number, maxHeight: number): FittedText {
  const sizes = [16, 15, 14, 13, 12, 11, 10];
  for (const size of sizes) {
    const lineHeight = Math.round(size * 1.375);
    const lines = wrap(text, font, size, maxWidth);
    if (lines.length * lineHeight + PLATE_PAD * 2 <= maxHeight) return { lines, size, lineHeight };
  }

  const size = sizes[sizes.length - 1];
  const lineHeight = Math.round(size * 1.375);
  const maxLines = Math.max(1, Math.floor((maxHeight - PLATE_PAD * 2) / lineHeight));
  const lines = wrap(text, font, size, maxWidth).slice(0, maxLines);
  lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[\s.,;:]+$/, '')}…`;
  return { lines, size, lineHeight };
}

/** Greedy word-wrap to a pixel width. */
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
