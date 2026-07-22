// Generates the downloadable sample storybook PDF for the landing "sample
// reader" section. It mirrors the real product's page format (square 8x8 trim,
// illustration on top, story text on a cream plate below), so what a parent
// downloads here matches what they'd receive after purchase.
//
// Run: node scripts/build-sample-pdf.mjs   (regenerate after changing pages/art)
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const L = (p) => join(ROOT, 'public/landing', p);

const PT = 72;
const SIZE = 8 * PT; // 576pt square page, like the product
const IMAGE_BOTTOM = SIZE * 0.32; // illustration fills the top ~68%
const PAD = 16;

const hex = (h) => {
  const n = h.replace('#', '');
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
};
const BG = hex('#FFF9F0');
const INK = hex('#242340');
const HAIR = hex('#E4E2F5');
const INDIGO = hex('#3B378F');

const TITLE = 'Aarav and the Star That Listens';
const SUBTITLE = 'A MoonBell sample story';
const PAGES = [
  {
    img: 'jasmine-spread.webp',
    text: 'Aarav reached up on tiptoe. "Star," he whispered, "can you really hear me?" The little star gave a wink, and leaned in close to listen.',
  },
  {
    img: 'moon-watch-spread.webp',
    text: 'So Aarav climbed the moonlit hill and asked his one small question. High above, the golden bell rang the softest ring, as if the whole sky had been waiting to answer.',
  },
];

// JPEG (not PNG) keeps the sample small enough to download quickly.
const jpg = async (name) => sharp(await readFile(L(name))).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();

function wrap(text, font, size, maxWidth) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawContained(page, img, bx, by, bw, bh) {
  const s = Math.min(bw / img.width, bh / img.height);
  const w = img.width * s, h = img.height * s;
  page.drawImage(img, { x: bx + (bw - w) / 2, y: by + (bh - h) / 2, width: w, height: h });
}

const doc = await PDFDocument.create();
const body = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

// Cover — full-bleed hero + indigo title plate
const cover = doc.addPage([SIZE, SIZE]);
cover.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: BG });
drawContained(cover, await doc.embedJpg(await jpg('herosectionimage.webp')), 0, 0, SIZE, SIZE);
const titleLines = wrap(TITLE, bold, 30, SIZE - 96);
const plateH = titleLines.length * 38 + 54;
cover.drawRectangle({ x: 30, y: 34, width: SIZE - 60, height: plateH, color: INDIGO, opacity: 0.86 });
titleLines.forEach((ln, i) => {
  const w = bold.widthOfTextAtSize(ln, 30);
  cover.drawText(ln, { x: (SIZE - w) / 2, y: 34 + plateH - 42 - i * 38, size: 30, font: bold, color: rgb(1, 1, 1) });
});
const subW = body.widthOfTextAtSize(SUBTITLE, 13);
cover.drawText(SUBTITLE, { x: (SIZE - subW) / 2, y: 48, size: 13, font: body, color: hex('#F5C85B') });

// Interior pages — illustration on top, story text on a cream plate below
for (const p of PAGES) {
  const page = doc.addPage([SIZE, SIZE]);
  page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: BG });
  drawContained(page, await doc.embedJpg(await jpg(p.img)), 0, IMAGE_BOTTOM, SIZE, SIZE - IMAGE_BOTTOM);
  const size = 15, lh = Math.round(size * 1.45);
  const lines = wrap(p.text, body, size, SIZE - 120);
  const ph = lines.length * lh + PAD * 2;
  page.drawRectangle({ x: 28, y: 30, width: SIZE - 56, height: ph, color: rgb(1, 1, 1), borderColor: HAIR, borderWidth: 1.5 });
  lines.forEach((ln, i) => {
    const w = body.widthOfTextAtSize(ln, size);
    page.drawText(ln, { x: (SIZE - w) / 2, y: 30 + ph - PAD - size - i * lh, size, font: body, color: INK });
  });
}

// Closing page
const end = doc.addPage([SIZE, SIZE]);
end.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: BG });
const endT = 'The End';
const eW = bold.widthOfTextAtSize(endT, 34);
end.drawText(endT, { x: (SIZE - eW) / 2, y: SIZE / 2 + 26, size: 34, font: bold, color: INDIGO });
const note = 'This is a MoonBell sample. Your child\'s own story is next  -  moonbell.in';
const nW = body.widthOfTextAtSize(note, 12);
end.drawText(note, { x: (SIZE - nW) / 2, y: SIZE / 2 - 14, size: 12, font: body, color: INK });

await mkdir(join(ROOT, 'public/sample'), { recursive: true });
const bytes = await doc.save();
await writeFile(join(ROOT, 'public/sample/moonbell-sample-story.pdf'), bytes);
console.log(`Wrote public/sample/moonbell-sample-story.pdf (${(bytes.length / 1024).toFixed(0)} KB, ${doc.getPageCount()} pages)`);
