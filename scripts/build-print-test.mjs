// Build the printer RFQ pack: one interior PDF and one casewrap, made of the
// pages that actually break on press.
//
// The point is not to look like a MoonBell book — it is to hand three printers
// the same file and find out which of them can hold a dark night sky without
// banding, keep Indian skin tones from going grey, hold 6pt type, and land the
// trim within a millimetre. A pretty sample proves none of that.
//
// Every test page is generated here rather than exported from a design tool, so
// the geometry is the same code the real print master uses.
//
// Run: node scripts/build-print-test.mjs
//      node scripts/print-preflight.mjs public/print-test/interior.pdf
import { PDFDocument, PDFName, PDFString, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/print-test');
const FONTS = join(ROOT, 'src/server/assets/fonts');

// Mirrors src/server/lib/print-spec.ts. Kept literal here because this script is
// what a printer quotes against — it must not silently follow a code change.
const PT = 72;
const TRIM = 8 * PT;
const BLEED = 0.125 * PT;
const PAGE = TRIM + BLEED * 2;
const SAFE = 0.375 * PT;
const GUTTER = 0.25 * PT;
const TARGET_PX = Math.ceil((PAGE / PT) * 300); // 2475

const hex = (h) => {
  const n = h.replace('#', '');
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
};
const INK = hex('#242340');
const CREAM = hex('#FFF9F0');
const INDIGO = hex('#5653C6');

/** Indian skin tones from the intake swatches — the ones that must not go grey. */
const SKIN = ['#F2D5BC', '#E3B591', '#C68A63', '#A2683F', '#6F4327'];

await mkdir(OUT, { recursive: true });

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const display = await doc.embedFont(await readFile(join(FONTS, 'PlayfairDisplay-Bold.ttf')), { subset: true });
const body = await doc.embedFont(await readFile(join(FONTS, 'Nunito-Regular.ttf')), { subset: true });
const bold = await doc.embedFont(await readFile(join(FONTS, 'Nunito-SemiBold.ttf')), { subset: true });

const addPage = () => {
  const p = doc.addPage([PAGE, PAGE]);
  p.node.set(PDFName.of('TrimBox'), doc.context.obj([BLEED, BLEED, BLEED + TRIM, BLEED + TRIM]));
  p.node.set(PDFName.of('BleedBox'), doc.context.obj([0, 0, PAGE, PAGE]));
  p.node.set(PDFName.of('ArtBox'), doc.context.obj([BLEED, BLEED, BLEED + TRIM, BLEED + TRIM]));
  return p;
};

const caption = (p, title, note) => {
  p.drawRectangle({ x: BLEED + SAFE, y: BLEED + SAFE, width: TRIM - SAFE * 2, height: 62, color: CREAM, opacity: 0.94 });
  p.drawText(title, { x: BLEED + SAFE + 14, y: BLEED + SAFE + 36, size: 13, font: bold, color: INK });
  for (const [i, line] of wrap(note, body, 9.5, TRIM - SAFE * 2 - 28).slice(0, 2).entries()) {
    p.drawText(line, { x: BLEED + SAFE + 14, y: BLEED + SAFE + 20 - i * 12, size: 9.5, font: body, color: INK });
  }
};

function wrap(text, font, size, maxWidth) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { out.push(line); line = word; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

/** A full-bleed raster at the real target resolution, so PPI reflects reality. */
async function fullBleed(page, png) {
  const img = await doc.embedPng(png);
  const scale = Math.max(PAGE / img.width, PAGE / img.height);
  page.drawImage(img, {
    x: (PAGE - img.width * scale) / 2,
    y: (PAGE - img.height * scale) / 2,
    width: img.width * scale,
    height: img.height * scale,
  });
}

// ---- 1. Trim, bleed and registration -------------------------------------
{
  const p = addPage();
  // Ink to the very edge of the sheet: any white showing after the cut means
  // the trim drifted outside the bleed allowance.
  p.drawRectangle({ x: 0, y: 0, width: PAGE, height: PAGE, color: INDIGO });
  p.drawRectangle({ x: BLEED, y: BLEED, width: TRIM, height: TRIM, borderColor: rgb(1, 1, 1), borderWidth: 1, opacity: 0 });
  // A ruled band every 0.125in outward from the trim: the printer can read off
  // exactly how far the cut landed from where it should have.
  for (let i = 1; i <= 3; i += 1) {
    const inset = BLEED - (BLEED / 3) * i;
    p.drawRectangle({
      x: inset, y: inset, width: PAGE - inset * 2, height: PAGE - inset * 2,
      borderColor: rgb(1, 1, 1), borderWidth: 0.5, opacity: 0,
    });
  }
  // Corner marks sitting exactly on the safe-area boundary.
  for (const [cx, cy] of [[BLEED + SAFE, BLEED + SAFE], [PAGE - BLEED - SAFE, BLEED + SAFE], [BLEED + SAFE, PAGE - BLEED - SAFE], [PAGE - BLEED - SAFE, PAGE - BLEED - SAFE]]) {
    p.drawCircle({ x: cx, y: cy, size: 4, color: rgb(1, 1, 1) });
  }
  caption(p, '1 · Trim, bleed and registration', 'White inner square = 8in trim. Rings are 1/24in apart across the 1/8in bleed. Report how far the cut landed from the trim line.');
}

// ---- 2. Dark night scene (banding + shadow detail) ------------------------
{
  const p = addPage();
  const px = TARGET_PX;
  // A smooth vertical ramp through very dark values plus small bright points:
  // cheap presses band the ramp and crush the stars into the background.
  const raw = Buffer.alloc(px * px * 3);
  for (let y = 0; y < px; y += 1) {
    const t = y / px;
    const r = Math.round(6 + t * 26);
    const g = Math.round(8 + t * 30);
    const b = Math.round(22 + t * 66);
    for (let x = 0; x < px; x += 1) {
      const i = (y * px + x) * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  for (let s = 0; s < 240; s += 1) {
    const x = Math.floor((s * 7919) % px);
    const y = Math.floor((s * 104729) % px);
    const v = 120 + ((s * 37) % 135);
    for (let dy = 0; dy < 3; dy += 1) {
      for (let dx = 0; dx < 3; dx += 1) {
        const i = ((y + dy) % px * px + ((x + dx) % px)) * 3;
        raw[i] = v; raw[i + 1] = v; raw[i + 2] = Math.min(255, v + 24);
      }
    }
  }
  await fullBleed(p, await sharp(raw, { raw: { width: px, height: px, channels: 3 } }).png().toBuffer());
  caption(p, '2 · Dark scene: banding and shadow detail', 'A near-black gradient with small highlights. Look for stepped bands in the sky and stars lost into the background.');
}

// ---- 3. Indian skin tones ------------------------------------------------
{
  const p = addPage();
  const px = TARGET_PX;
  const band = Math.floor(px / SKIN.length);
  const raw = Buffer.alloc(px * px * 3);
  SKIN.forEach((tone, k) => {
    const n = tone.replace('#', '');
    const base = [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
    for (let y = k * band; y < Math.min(px, (k + 1) * band); y += 1) {
      for (let x = 0; x < px; x += 1) {
        // Shade each band left-to-right so we also see how the tone holds in
        // shadow, which is where skin most often turns grey or green.
        const shade = 0.72 + (x / px) * 0.28;
        const i = (y * px + x) * 3;
        raw[i] = Math.round(base[0] * shade);
        raw[i + 1] = Math.round(base[1] * shade);
        raw[i + 2] = Math.round(base[2] * shade);
      }
    }
  });
  await fullBleed(p, await sharp(raw, { raw: { width: px, height: px, channels: 3 } }).png().toBuffer());
  caption(p, '3 · Indian skin tones, lit and shaded', 'Five intake swatches, each shaded 72–100%. Report any band that prints grey, green or orange against the supplied sRGB values.');
}

// ---- 4. Fine line detail --------------------------------------------------
{
  const p = addPage();
  p.drawRectangle({ x: 0, y: 0, width: PAGE, height: PAGE, color: CREAM });
  // Hairlines from 0.25pt down: below a press's reproducible minimum they either
  // disappear or thicken into a smudge.
  const weights = [1, 0.75, 0.5, 0.35, 0.25, 0.15];
  weights.forEach((w, i) => {
    const y = PAGE - BLEED - SAFE - 40 - i * 46;
    p.drawLine({ start: { x: BLEED + SAFE, y }, end: { x: PAGE - BLEED - SAFE, y }, thickness: w, color: INK });
    p.drawText(`${w}pt`, { x: BLEED + SAFE, y: y + 8, size: 8, font: body, color: INK });
  });
  // Converging lines: a moiré and fine-detail test in one.
  for (let i = 0; i < 60; i += 1) {
    const x = BLEED + SAFE + i * ((TRIM - SAFE * 2) / 60);
    p.drawLine({ start: { x, y: BLEED + SAFE + 90 }, end: { x: PAGE / 2, y: PAGE / 2 - 40 }, thickness: 0.3, color: INDIGO });
  }
  caption(p, '4 · Hairlines and convergence', 'Rules from 1pt to 0.15pt plus a converging fan. Report the thinnest rule that prints cleanly and any moiré in the fan.');
}

// ---- 5. Small type --------------------------------------------------------
{
  const p = addPage();
  p.drawRectangle({ x: 0, y: 0, width: PAGE, height: PAGE, color: CREAM });
  const sample = 'MoonBell 0123456789 — the quick brown fox jumps over the lazy dog. Aarav, Diya, Ishaan.';
  let y = PAGE - BLEED - SAFE - 40;
  for (const size of [12, 10, 9, 8, 7, 6, 5]) {
    p.drawText(`${size}pt`, { x: BLEED + SAFE, y, size: 8, font: bold, color: INDIGO });
    for (const line of wrap(sample, body, size, TRIM - SAFE * 2 - 40).slice(0, 2)) {
      p.drawText(line, { x: BLEED + SAFE + 34, y, size, font: body, color: INK });
      y -= size * 1.5;
    }
    y -= 14;
  }
  // Reversed out of a solid: small type in white is where ink spread shows.
  p.drawRectangle({ x: BLEED + SAFE, y: BLEED + SAFE + 74, width: TRIM - SAFE * 2, height: 92, color: INK });
  let ry = BLEED + SAFE + 148;
  for (const size of [9, 7, 6]) {
    p.drawText(`${size}pt reversed — ${sample.slice(0, 52)}`, { x: BLEED + SAFE + 12, y: ry, size, font: body, color: rgb(1, 1, 1) });
    ry -= size * 2.4;
  }
  caption(p, '5 · Small type, positive and reversed', 'Report the smallest size that stays legible, and whether reversed type fills in.');
}

// ---- 6. Cross-spread continuity ------------------------------------------
// Two facing pages carrying one image: the join is where binding and trim
// errors become obvious, and it is the shot a picture book most wants.
for (const [half, label] of [['left', 'verso'], ['right', 'recto']]) {
  const p = addPage();
  const px = TARGET_PX;
  const raw = Buffer.alloc(px * px * 3);
  for (let y = 0; y < px; y += 1) {
    for (let x = 0; x < px; x += 1) {
      // A continuous horizontal ramp across BOTH pages: u runs 0->0.5 on the
      // left leaf and 0.5->1 on the right, so a mismatch at the spine is visible.
      const u = (half === 'left' ? x / px / 2 : 0.5 + x / px / 2);
      const i = (y * px + x) * 3;
      raw[i] = Math.round(40 + u * 190);
      raw[i + 1] = Math.round(70 + u * 120);
      raw[i + 2] = Math.round(150 - u * 60);
      // A horizontal rule that must line up across the gutter.
      if (Math.abs(y - px * 0.42) < px * 0.004) { raw[i] = 255; raw[i + 1] = 255; raw[i + 2] = 255; }
    }
  }
  await fullBleed(p, await sharp(raw, { raw: { width: px, height: px, channels: 3 } }).png().toBuffer());
  caption(p, `6 · Cross-spread continuity (${label})`, 'These two pages form one image. The white rule and the colour ramp must meet at the spine with no jump or gap.');
}

// ---- 7. Edge-adjacent elements + gutter ----------------------------------
{
  const p = addPage();
  p.drawRectangle({ x: 0, y: 0, width: PAGE, height: PAGE, color: CREAM });
  // Text set right at the safe line and again in the gutter zone — proves how
  // much of the inner margin the binding actually swallows.
  p.drawRectangle({ x: BLEED, y: BLEED, width: TRIM, height: TRIM, borderColor: INDIGO, borderWidth: 0.5, opacity: 0 });
  p.drawRectangle({ x: BLEED + SAFE, y: BLEED + SAFE, width: TRIM - SAFE * 2, height: TRIM - SAFE * 2, borderColor: hex('#C9432F'), borderWidth: 0.5, opacity: 0 });
  p.drawText('SAFE AREA EDGE — this line must survive the trim', { x: BLEED + SAFE + 4, y: PAGE - BLEED - SAFE - 12, size: 9, font: bold, color: INK });
  p.drawText('TRIM EDGE — everything outside is cut away', { x: BLEED + 4, y: PAGE - BLEED - 12, size: 9, font: bold, color: INDIGO });
  for (let i = 0; i < 8; i += 1) {
    const x = BLEED + SAFE + GUTTER;
    p.drawText(`gutter+${(GUTTER / PT).toFixed(2)}in · line ${i + 1} must stay readable when the book is open`, {
      x, y: PAGE / 2 - i * 18, size: 9, font: body, color: INK,
    });
  }
  p.drawLine({ start: { x: BLEED + SAFE + GUTTER, y: BLEED + SAFE }, end: { x: BLEED + SAFE + GUTTER, y: PAGE - BLEED - SAFE }, thickness: 0.4, color: hex('#F5C85B') });
  caption(p, '7 · Safe area, trim and gutter', 'Indigo = trim, coral = safe area, gold = gutter limit. Report anything clipped by the cut or lost into the binding.');
}

doc.setTitle('MoonBell printer RFQ — interior test form');
doc.setAuthor('MoonBell');
doc.setSubject('Interior press test: trim/bleed, dark scenes, skin tones, fine detail, small type, cross-spread, gutter');
doc.setProducer('MoonBell print pipeline');
doc.setCreator('MoonBell');
doc.catalog.set(
  PDFName.of('OutputIntents'),
  doc.context.obj([
    doc.context.obj({
      Type: PDFName.of('OutputIntent'),
      S: PDFName.of('GTS_PDFA1'),
      OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
      RegistryName: PDFString.of('http://www.color.org'),
    }),
  ]),
);

await writeFile(join(OUT, 'interior.pdf'), Buffer.from(await doc.save()));

// ---- Casewrap ------------------------------------------------------------
// Placeholder stock until a printer sends their template — the point of the RFQ
// is partly to get those numbers, so the geometry is generated from parameters
// rather than assumed correct.
const CASE = { paperCaliper: 0.0055 * PT, boardCaliper: 0.098 * PT, turnIn: 0.625 * PT, hingeGap: 0.3125 * PT };
const sheets = 20 / 2;
const spineWidth = sheets * CASE.paperCaliper + CASE.boardCaliper * 2;
const overhang = 0.125 * PT;
const boardW = TRIM + overhang;
const boardH = TRIM + overhang * 2;
const sheetW = boardW * 2 + spineWidth + CASE.hingeGap * 2 + CASE.turnIn * 2;
const sheetH = boardH + CASE.turnIn * 2;

const wrapDoc = await PDFDocument.create();
wrapDoc.registerFontkit(fontkit);
const wDisplay = await wrapDoc.embedFont(await readFile(join(FONTS, 'PlayfairDisplay-Bold.ttf')), { subset: true });
const wBody = await wrapDoc.embedFont(await readFile(join(FONTS, 'Nunito-Regular.ttf')), { subset: true });
const wrapPage = wrapDoc.addPage([sheetW, sheetH]);
wrapPage.drawRectangle({ x: 0, y: 0, width: sheetW, height: sheetH, color: INDIGO });

const spineX = CASE.turnIn + boardW + CASE.hingeGap;
// Fold lines, so the printer can confirm their template against ours.
for (const x of [CASE.turnIn, CASE.turnIn + boardW, spineX, spineX + spineWidth, spineX + spineWidth + CASE.hingeGap]) {
  wrapPage.drawLine({ start: { x, y: 0 }, end: { x, y: sheetH }, thickness: 0.5, color: hex('#F5C85B') });
}
for (const y of [CASE.turnIn, sheetH - CASE.turnIn]) {
  wrapPage.drawLine({ start: { x: 0, y }, end: { x: sheetW, y }, thickness: 0.5, color: hex('#F5C85B') });
}
wrapPage.drawText('FRONT', { x: spineX + spineWidth + CASE.hingeGap + 24, y: sheetH / 2, size: 24, font: wDisplay, color: rgb(1, 1, 1) });
wrapPage.drawText('BACK', { x: CASE.turnIn + 24, y: sheetH / 2, size: 24, font: wDisplay, color: rgb(1, 1, 1) });
wrapPage.drawText(
  `Spine ${(spineWidth / PT).toFixed(3)}in for a 20pp block — CONFIRM against your caliper`,
  { x: CASE.turnIn + 24, y: CASE.turnIn + 24, size: 10, font: wBody, color: rgb(1, 1, 1) },
);
wrapPage.drawText(
  `Sheet ${(sheetW / PT).toFixed(3)} x ${(sheetH / PT).toFixed(3)}in · turn-in ${(CASE.turnIn / PT).toFixed(3)}in · hinge ${(CASE.hingeGap / PT).toFixed(3)}in`,
  { x: CASE.turnIn + 24, y: CASE.turnIn + 8, size: 10, font: wBody, color: rgb(1, 1, 1) },
);
wrapDoc.setTitle('MoonBell printer RFQ — casewrap test form');
wrapDoc.setAuthor('MoonBell');
await writeFile(join(OUT, 'casewrap.pdf'), Buffer.from(await wrapDoc.save()));

// ---- The spec sheet that travels with the files --------------------------
const spec = `MoonBell — printer RFQ
======================

Two files accompany this sheet:

  interior.pdf   8 test pages at production geometry
  casewrap.pdf   one flat case sheet with fold lines marked

Product
  Title            Personalised children's picture book, printed one at a time
  Trim             8.000 x 8.000 in square
  Bleed            0.125 in on all four sides (page box 8.250 x 8.250 in)
  Safe area        0.375 in from trim; a further 0.250 in gutter at the spine
  Interior         20 pages (12 illustrated story pages plus front and end matter)
  Binding          Casebound hardcover, matte lamination
  Paper            Please quote your closest stock to 150gsm matte text
  Board            Please quote your standard, and give us its caliper
  Colour           Supplied as sRGB IEC61966-2.1; convert to your press profile
  Images           300 PPI target, 250 PPI minimum at placed size
  Casewrap         Spine computed as (sheets x paper caliper) + 2 x board caliper.
                   Our placeholder gives ${(spineWidth / PT).toFixed(3)} in for 20pp —
                   please send your template and formula.

Volumes
  Every book is different: expect single-copy orders, variable content, no reprints
  of the same file. Please quote per-unit at 1, 25, 75 and 250 copies per month,
  and state your minimum order and setup fee if any.

What we need back
  1. Printed proofs of both files — two copies.
  2. Your casewrap template and spine formula for this page count and stock.
  3. Turnaround from file receipt to dispatch, and your cut-off time.
  4. Whether any part of the job is subcontracted, and to whom.
  5. Confirmation you can accept per-order variable files via API or upload.
  6. Your preflight report on our files, including anything you would change.

What we will assess
  Trim accuracy against the registration rings on page 1; banding and shadow
  detail on page 2; skin-tone fidelity on page 3 against the supplied sRGB values;
  smallest clean rule on page 4; smallest legible type on page 5; spine alignment
  across the spread on pages 6-7; and clipping at the trim or in the gutter on
  page 8. Also binding strength, hinge action, lamination finish, and how the
  package survives shipping.

Contact
  [TODO: fill from src/lib/business.ts before sending]
`;
await writeFile(join(OUT, 'RFQ.txt'), spec);

console.log(`Wrote:
  ${join(OUT, 'interior.pdf')}   (${doc.getPageCount()} pages, ${TARGET_PX}px artwork)
  ${join(OUT, 'casewrap.pdf')}   (${(sheetW / PT).toFixed(3)} x ${(sheetH / PT).toFixed(3)}in flat)
  ${join(OUT, 'RFQ.txt')}

Next: node scripts/print-preflight.mjs public/print-test/interior.pdf`);
