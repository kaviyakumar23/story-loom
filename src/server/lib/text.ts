/**
 * What the PDF can actually print.
 *
 * pdf-lib's StandardFonts encode WinAnsi (CP1252) only and throw on anything
 * else — verified: `WinAnsi cannot encode "आ" (0x0906)`. That throw would land
 * during fulfillment, i.e. AFTER the parent has paid, so both ends are guarded:
 *
 *   - `isPdfSafe` gates the child's nickname at intake. A name is never
 *     silently mangled — we tell the parent up front instead.
 *   - `pdfSafe` scrubs model-written story text at the PDF boundary. A story
 *     that comes back with an emoji must not brick a book someone paid for.
 *
 * Embedding a Unicode font (Baloo 2 already covers Latin + Devanagari) would
 * lift this limit; until then the constraint is enforced, not hoped for.
 */

/** CP1252's additions above Latin-1 — smart quotes, dashes, ellipsis, €… */
const WINANSI_SPECIALS = new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ']);

function encodable(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp >= 0x20 && cp <= 0x7e) return true; // ASCII printable
  if (cp >= 0xa0 && cp <= 0xff) return true; // Latin-1 supplement (é, ñ, ü…)
  return WINANSI_SPECIALS.has(ch);
}

/** True when every character survives PDF encoding. Use to validate at intake. */
export function isPdfSafe(text: string): boolean {
  return [...text].every(encodable);
}

/** Drop what the PDF cannot encode. Use on model output, never on a name. */
export function pdfSafe(text: string): string {
  return [...text]
    .filter(encodable)
    .join('')
    .replace(/[ \t]{2,}/g, ' ');
}
