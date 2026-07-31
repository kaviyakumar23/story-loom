import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName, PDFString, rgb } from 'pdf-lib';
import { COLORS } from './brand';
import { DEFAULT_CASEWRAP_PARAMS, INTERIOR_PAGES, PT_PER_INCH, casewrapSpec, type CasewrapParams } from './print-spec';
import { pdfSafe } from './text';

/**
 * The printed case: back cover, spine and front cover on one flat sheet, plus
 * the turn-in that folds around the board edges.
 *
 * A hardcover's case is not a page — it is a single sheet wrapped around two
 * boards with a gap between them, so its width depends on how thick the book
 * turns out. That thickness comes from the printer's paper and board caliper,
 * which is why every measurement here is a parameter rather than a constant:
 * the numbers arrive with the printer's template, and until then the defaults
 * are placeholders that produce a correctly-shaped file with the wrong spine.
 *
 * The spine text is the one part that genuinely cannot be guessed. On a 20-page
 * book the spine is only a few millimetres wide, so we print nothing on it —
 * type set into a spine that narrow drifts onto the front cover when the case
 * is folded even slightly off.
 */
const FONT_DIR = path.join(process.cwd(), 'src/server/assets/fonts');

export interface CasewrapInput {
  title: string;
  /** Back-cover blurb. Kept short — the back of a picture book is mostly art. */
  blurb?: string | null;
  interiorPages?: number;
  params?: CasewrapParams;
}

export async function buildCasewrap(input: CasewrapInput): Promise<Buffer> {
  const spec = casewrapSpec(input.interiorPages ?? INTERIOR_PAGES, input.params ?? DEFAULT_CASEWRAP_PARAMS);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const display = await doc.embedFont(await readFile(path.join(FONT_DIR, 'PlayfairDisplay-Bold.ttf')), { subset: true });
  const body = await doc.embedFont(await readFile(path.join(FONT_DIR, 'Nunito-Regular.ttf')), { subset: true });

  const page = doc.addPage([spec.sheetWidth, spec.sheetHeight]);
  page.drawRectangle({ x: 0, y: 0, width: spec.sheetWidth, height: spec.sheetHeight, color: hex(COLORS.berry) });

  const { turnIn } = spec.params;
  const frontX = spec.spineX + spec.spineWidth + spec.params.hingeGap;

  // Front cover: title, positioned inside the board so the fold cannot eat it.
  const title = pdfSafe(input.title);
  const lines = wrap(title, display, 30, spec.boardWidth - turnIn * 2);
  lines.forEach((line, i) => {
    const w = display.widthOfTextAtSize(line, 30);
    page.drawText(line, {
      x: frontX + (spec.boardWidth - w) / 2,
      y: spec.sheetHeight / 2 + 40 - i * 40,
      size: 30,
      font: display,
      color: rgb(1, 1, 1),
    });
  });
  page.drawText('A MoonBell storybook', {
    x: frontX + (spec.boardWidth - body.widthOfTextAtSize('A MoonBell storybook', 13)) / 2,
    y: spec.sheetHeight / 2 - 40 - lines.length * 12,
    size: 13,
    font: body,
    color: rgb(1, 1, 1),
  });

  // Back cover.
  if (input.blurb?.trim()) {
    const blurb = wrap(pdfSafe(input.blurb.trim()), body, 13, spec.boardWidth - turnIn * 3);
    blurb.slice(0, 6).forEach((line, i) => {
      page.drawText(line, {
        x: turnIn + turnIn,
        y: spec.sheetHeight / 2 + 30 - i * 20,
        size: 13,
        font: body,
        color: rgb(1, 1, 1),
      });
    });
  }
  page.drawText('moonbell.in', { x: turnIn + turnIn, y: turnIn + 24, size: 11, font: body, color: rgb(1, 1, 1) });

  setMetadata(doc, input.title, spec.spineWidth);
  return Buffer.from(await doc.save());
}

function setMetadata(doc: PDFDocument, title: string, spineWidth: number): void {
  doc.setTitle(`${pdfSafe(title)} — MoonBell casewrap`);
  doc.setAuthor('MoonBell');
  doc.setSubject(`Casewrap, spine ${(spineWidth / PT_PER_INCH).toFixed(3)}in — confirm against printer template`);
  doc.setProducer('MoonBell print pipeline');
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
}

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      out.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

function hex(h: string) {
  const n = h.replace('#', '');
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}
