import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
  type PDFPage,
} from 'pdf-lib';
import { INTERIOR_PAGES, PAGE, PPI_FLOOR, PPI_TARGET, PT_PER_INCH, TRIM } from './print-spec.ts';

/**
 * Preflight: does this file print correctly, or only look correct?
 *
 * Everything checked here is invisible on a screen and fatal on a press — an
 * unembedded font gets substituted by the printer's RIP, a missing bleed box
 * trims to a white edge, and artwork that is fine at thumbnail size is soft at
 * eight inches. The checks report the measured number rather than a verdict
 * alone, so a failure can be taken up with the printer instead of just believed.
 *
 * Run against every print master before release; the report is stored with the
 * book so a defect can be traced to the file that produced it.
 */
export type PreflightMode = 'interior' | 'casewrap' | 'test-form';

export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface PlacedImage {
  page: number;
  name: string;
  widthPx: number;
  heightPx: number;
  widthIn: number;
  ppi: number;
}

export interface PreflightReport {
  mode: PreflightMode;
  ok: boolean;
  pages: number;
  checks: PreflightCheck[];
  images: PlacedImage[];
  fonts: { baseFont: string; embedded: boolean; subset: boolean }[];
  lowestPpi: number | null;
}

/** pdf-lib's typed lookup throws on a missing key; preflight must never throw. */
function dictAt(dict: PDFDict | undefined | null, key: string): PDFDict | null {
  const v = dict?.lookup(PDFName.of(key));
  return v instanceof PDFDict ? v : null;
}
function arrayAt(dict: PDFDict | undefined | null, key: string): PDFArray | null {
  const v = dict?.lookup(PDFName.of(key));
  return v instanceof PDFArray ? v : null;
}

export async function preflight(bytes: Buffer, mode: PreflightMode = 'interior'): Promise<PreflightReport> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  const checks: PreflightCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const inch = (pt: number) => (pt / PT_PER_INCH).toFixed(3);

  // ---- page count --------------------------------------------------------
  if (mode === 'interior') {
    // The cover leaf plus the interior block. A sewn signature folds in
    // multiples of four, so an off-count means the printer adds blank leaves
    // or refuses the job.
    const expected = INTERIOR_PAGES + 1;
    add('page count', pages.length === expected, `${pages.length} pages (expected ${expected}: cover + ${INTERIOR_PAGES}pp block)`);
  } else if (mode === 'casewrap') {
    add('page count', pages.length === 1, `${pages.length} page (a casewrap is one flat sheet)`);
  } else {
    add('page count', pages.length > 0, `${pages.length} test pages`);
  }

  // ---- geometry ----------------------------------------------------------
  const detail: string[] = [];
  let geometryOk = true;
  pages.forEach((page, i) => {
    const media = page.getMediaBox();
    const hasTrim = Boolean(page.node.get(PDFName.of('TrimBox')));
    const hasBleed = Boolean(page.node.get(PDFName.of('BleedBox')));

    if (mode === 'casewrap') {
      detail.push(`p${i + 1}: ${inch(media.width)}x${inch(media.height)}in flat sheet`);
      return;
    }
    const trim = hasTrim ? page.getTrimBox() : null;
    const mediaOk = Math.abs(media.width - PAGE) < 0.5 && Math.abs(media.height - PAGE) < 0.5;
    const trimOk = trim != null && Math.abs(trim.width - TRIM) < 0.5 && Math.abs(trim.height - TRIM) < 0.5;
    if (!mediaOk || !trimOk || !hasBleed) {
      geometryOk = false;
      detail.push(
        `p${i + 1}: media ${inch(media.width)}x${inch(media.height)}in` +
          `${trim ? `, trim ${inch(trim.width)}x${inch(trim.height)}in` : ', NO TrimBox'}` +
          `${hasBleed ? '' : ', NO BleedBox'}`,
      );
    }
  });
  add(
    'page geometry',
    geometryOk,
    mode === 'casewrap'
      ? detail.join('; ')
      : geometryOk
        ? `all pages ${inch(PAGE)}in square with a ${inch(TRIM)}in trim box`
        : detail.slice(0, 6).join('; '),
  );

  // ---- fonts -------------------------------------------------------------
  const fonts = new Map<string, { baseFont: string; embedded: boolean; subset: boolean }>();
  for (const page of pages) {
    const dict = dictAt(page.node.Resources(), 'Font');
    if (!dict) continue;
    for (const key of dict.keys()) {
      const font = dict.lookup(key);
      if (font instanceof PDFDict) collectFont(font, fonts);
    }
  }
  const unembedded = [...fonts.values()].filter((f) => !f.embedded);
  add(
    'fonts embedded',
    fonts.size > 0 && unembedded.length === 0,
    fonts.size === 0
      ? 'no fonts found — is there any text at all?'
      : unembedded.length
        ? `NOT embedded: ${unembedded.map((f) => f.baseFont).join(', ')} — the printer will substitute these`
        : `${[...fonts.values()].map((f) => f.baseFont).join(', ')} — all embedded`,
  );

  // ---- images ------------------------------------------------------------
  const images: PlacedImage[] = [];
  pages.forEach((page, i) => {
    for (const p of placedImages(page)) {
      images.push({
        page: i + 1,
        name: p.name,
        widthPx: p.widthPx,
        heightPx: p.heightPx,
        widthIn: Number((p.widthPt / PT_PER_INCH).toFixed(3)),
        ppi: p.widthPt > 0 ? Math.round(p.widthPx / (p.widthPt / PT_PER_INCH)) : 0,
      });
    }
  });
  const lowestPpi = images.length ? Math.min(...images.map((im) => im.ppi)) : null;
  const under = images.filter((im) => im.ppi < PPI_FLOOR);
  add(
    'image resolution',
    under.length === 0 && (images.length > 0 || mode === 'casewrap'),
    images.length === 0
      ? mode === 'casewrap'
        ? 'vector only — nothing to resample'
        : 'no images found'
      : under.length
        ? `${under.length} of ${images.length} below ${PPI_FLOOR} PPI (lowest ${lowestPpi})`
        : `${images.length} images, lowest ${lowestPpi} PPI (target ${PPI_TARGET})`,
  );

  // ---- colour + identity -------------------------------------------------
  const intents = arrayAt(doc.catalog, 'OutputIntents');
  const first = intents?.lookup(0);
  const intent = first instanceof PDFDict ? first : null;
  add(
    'output intent',
    Boolean(intent) || mode === 'casewrap',
    intent ? 'sRGB declared' : 'none — the printer has to guess how to convert our colours',
  );

  const title = doc.getTitle();
  add('document title', Boolean(title), title ? `"${title}"` : 'unset — files land unnamed in a print queue');

  return {
    mode,
    ok: checks.every((c) => c.ok),
    pages: pages.length,
    checks,
    images,
    fonts: [...fonts.values()],
    lowestPpi,
  };
}

function collectFont(font: PDFDict, out: Map<string, { baseFont: string; embedded: boolean; subset: boolean }>): void {
  // A Type0 font wraps a descendant that holds the actual embedding.
  if (font.get(PDFName.of('Subtype'))?.toString() === '/Type0') {
    const child = arrayAt(font, 'DescendantFonts')?.lookup(0);
    if (child instanceof PDFDict) return collectFont(child, out);
  }
  const baseFont = font.get(PDFName.of('BaseFont'))?.toString().replace(/^\//, '') ?? 'unknown';
  const descriptor = dictAt(font, 'FontDescriptor');
  const embedded = Boolean(
    descriptor &&
      (descriptor.get(PDFName.of('FontFile')) ||
        descriptor.get(PDFName.of('FontFile2')) ||
        descriptor.get(PDFName.of('FontFile3'))),
  );
  out.set(baseFont, { baseFont, embedded, subset: /^[A-Z]{6}\+/.test(baseFont) });
}

/**
 * Walk the content stream tracking the transform matrix, so each image is
 * measured at the size it is actually drawn. An image's own pixel dimensions say
 * nothing about resolution on paper — placement is what decides it.
 */
function placedImages(page: PDFPage): { name: string; widthPx: number; heightPx: number; widthPt: number }[] {
  const out: { name: string; widthPx: number; heightPx: number; widthPt: number }[] = [];
  const xobjects = dictAt(page.node.Resources(), 'XObject');
  const contents = page.node.Contents();
  if (!xobjects || !contents) return out;

  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => page.doc.context.lookup(ref))
      : [contents];
  const text = streams
    .filter((s): s is PDFRawStream => s instanceof PDFRawStream)
    .map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1'))
    .join('\n');

  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const nums: number[] = [];
  let pendingName: string | null = null;

  for (const tok of text.match(/\/[^\s/[\]<>()]+|-?\d*\.?\d+|[A-Za-z'"]+/g) ?? []) {
    if (/^-?\d*\.?\d+$/.test(tok)) {
      nums.push(Number(tok));
      continue;
    }
    if (tok.startsWith('/')) {
      pendingName = tok.slice(1);
      continue;
    }
    if (tok === 'q') stack.push([...ctm]);
    else if (tok === 'Q') ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (tok === 'cm' && nums.length >= 6) ctm = multiply(nums.slice(-6), ctm);
    else if (tok === 'Do' && pendingName) {
      const xo = xobjects.lookup(PDFName.of(pendingName));
      if (xo instanceof PDFRawStream && xo.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
        const w = xo.dict.lookup(PDFName.of('Width'));
        const h = xo.dict.lookup(PDFName.of('Height'));
        out.push({
          name: pendingName,
          widthPx: w instanceof PDFNumber ? w.asNumber() : 0,
          heightPx: h instanceof PDFNumber ? h.asNumber() : 0,
          // A unit square under the CTM is the drawn rectangle.
          widthPt: Math.abs(Math.hypot(ctm[0], ctm[1])),
        });
      }
    }
    nums.length = 0;
  }
  return out;
}

function multiply(m: number[], n: number[]): number[] {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

/** Plain-text report for the CLI and for pasting into a printer email. */
export function formatReport(report: PreflightReport, file: string): string {
  const lines = [`\nPreflight: ${file}  (${report.mode}, ${report.pages} pages)\n`];
  for (const c of report.checks) lines.push(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(18)} ${c.detail}`);
  if (report.images.length) {
    lines.push('\n  Images (resolution at placed size):');
    for (const im of report.images) {
      const flag = im.ppi < PPI_FLOOR ? ' <-- below floor' : im.ppi < PPI_TARGET ? ' (under target)' : '';
      lines.push(`    p${String(im.page).padStart(2)}  ${`${im.widthPx}x${im.heightPx}`.padEnd(11)} in ${im.widthIn}in  =  ${im.ppi} PPI${flag}`);
    }
  }
  const failed = report.checks.filter((c) => !c.ok).length;
  lines.push(`\n  ${report.ok ? 'Ready to send to a printer.' : `${failed} check(s) failed.`}\n`);
  return lines.join('\n');
}
