import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from 'pdf-lib';
import { fetchWithTimeout } from './http';
import { COLORS } from './brand';

/**
 * Print-quality PDF assembly (§6 step 10, §11) using pdf-lib — pure JS, no
 * headless browser, so it runs in a serverless function. The real hero name is
 * already injected locally into the page text before this point (§9).
 *
 * Square 8"×8" picture-book trim. Each interior page: illustration on top,
 * story text on a cream plate below. Standard fonts keep it dependency-free
 * (embedding the Baloo display font is a later enhancement).
 */
const PT = 72;
const SIZE = 8 * PT; // 576pt square

export interface AssemblePage {
  text: string;
  imageUrl: string | null;
}
export interface AssembleInput {
  title: string;
  coverImageUrl: string | null;
  pages: AssemblePage[];
}

export async function assemblePdf(input: AssembleInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const display = await doc.embedFont(StandardFonts.HelveticaBold);

  // Cover
  const cover = doc.addPage([SIZE, SIZE]);
  paintBg(cover);
  const coverImg = await embed(doc, input.coverImageUrl);
  if (coverImg) drawContained(cover, coverImg, 0, 0, SIZE, SIZE);
  // Title plate + text
  const titleLines = wrap(input.title, display, 30, SIZE - 96);
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
    const img = await embed(doc, page.imageUrl);
    const imgBottom = SIZE * 0.32;
    if (img) drawContained(p, img, 0, imgBottom, SIZE, SIZE - imgBottom);
    // text plate
    const lines = wrap(page.text, body, 16, SIZE - 120);
    const ph = lines.length * 22 + 28;
    p.drawRectangle({ x: 28, y: 28, width: SIZE - 56, height: Math.min(ph, imgBottom - 20), color: hex(COLORS.surface), borderColor: hex(COLORS.hairline), borderWidth: 1.5 });
    lines.forEach((line, i) => {
      const w = body.widthOfTextAtSize(line, 16);
      p.drawText(line, { x: (SIZE - w) / 2, y: 28 + ph - 30 - i * 22, size: 16, font: body, color: hex(COLORS.ink) });
    });
  }

  return Buffer.from(await doc.save());
}

function paintBg(page: { drawRectangle: (o: Record<string, unknown>) => void }) {
  page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: hex(COLORS.bg) });
}

/** Fetch + embed an image (PNG or JPEG, sniffed by signature). */
async function embed(doc: PDFDocument, url: string | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const res = await fetchWithTimeout(url, {}, 30_000);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
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
