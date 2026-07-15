import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { assemblePdf } from './pdf';
import { isPdfSafe, pdfSafe } from './text';

/** Smallest valid PNG (1×1) — enough to exercise embedding and layout. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function helvetica() {
  const doc = await PDFDocument.create();
  return doc.embedFont(StandardFonts.Helvetica);
}

describe('WinAnsi table in text.ts matches pdf-lib reality', () => {
  // text.ts hand-writes which characters the standard PDF fonts encode. Check
  // that claim against pdf-lib itself rather than trusting the table.
  it('every character isPdfSafe accepts really encodes', async () => {
    const font = await helvetica();
    const candidates: string[] = [];
    for (let cp = 0x20; cp <= 0xff; cp += 1) candidates.push(String.fromCodePoint(cp));
    candidates.push(...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

    for (const ch of candidates.filter(isPdfSafe)) {
      expect(() => font.widthOfTextAtSize(ch, 12), `U+${ch.codePointAt(0)?.toString(16)}`).not.toThrow();
    }
  });

  it('pdfSafe output of hostile input is always encodable', async () => {
    const font = await helvetica();
    const nasty = 'Aarav आरव 🎉 José “q” — … €5 中文 தமிழ் ';
    expect(() => font.widthOfTextAtSize(pdfSafe(nasty), 12)).not.toThrow();
  });
});

describe('assemblePdf', () => {
  it('assembles a cover and pages into a PDF', async () => {
    const pdf = await assemblePdf({
      title: "Aarav's Big Day",
      coverImage: PNG_1X1,
      pages: [
        { text: 'Aarav woke up early.', image: PNG_1X1 },
        { text: 'He packed his bag.', image: PNG_1X1 },
      ],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(3); // cover + 2
  });

  it('does not crash when the story model emits an emoji or non-Latin text', async () => {
    // Regression: WinAnsi cannot encode these, and this runs AFTER payment.
    const pdf = await assemblePdf({
      title: 'A Day Out 🎉',
      coverImage: PNG_1X1,
      pages: [{ text: 'Aarav said नमस्ते 🎈 and smiled.', image: PNG_1X1 }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('throws on unusable image bytes instead of shipping a book without pictures', async () => {
    // Regression: embed() used to swallow failures and return a text-only PDF.
    await expect(
      assemblePdf({
        title: 'Broken',
        coverImage: Buffer.from('not an image'),
        pages: [{ text: 'page', image: PNG_1X1 }],
      }),
    ).rejects.toThrow();

    await expect(
      assemblePdf({
        title: 'Broken page',
        coverImage: PNG_1X1,
        pages: [{ text: 'page', image: Buffer.from('not an image') }],
      }),
    ).rejects.toThrow();
  });

  it('fits an over-long page instead of spilling text over the illustration', async () => {
    const long = 'The little fox wandered through the tall grass looking for berries. '.repeat(20);
    const pdf = await assemblePdf({
      title: 'Long',
      coverImage: PNG_1X1,
      pages: [{ text: long, image: PNG_1X1 }],
    });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(2);
  });
});
