/**
 * Storyloom brand tokens — the canonical design system from the Claude Design
 * handoff (children-book/project/styles.css). Single source of truth for the
 * backend-rendered surfaces: transactional emails (lib/email.ts) and the PDF
 * storybook (lib/pdf.ts). Keep these values in sync with the frontend's CSS
 * variables so emails, PDF, and app feel like one product.
 *
 * Aesthetic: "warm, painted, playful" — buttery cream paper, storybook palette,
 * rounded display type (Baloo 2), chunky sticker buttons.
 */
export const COLORS = {
  bg: '#FBEFD6', // buttery cream
  bg2: '#F8E2C3', // warm peach band
  surface: '#FFFBF2', // soft paper-white card
  ink: '#3A2A22', // warm cocoa-black
  inkSoft: '#7C6A5A', // muted secondary
  hairline: '#EBD7B6', // warm border

  berry: '#9C3C6B', // brand
  plum: '#6E2C58', // brand-deep (footer)
  brandTint: '#F7E0EA',
  teal: '#1F8C82', // eyebrow
  coral: '#EE6C45', // accent / action
  coralDeep: '#D9542F', // sticker shadow
  gold: '#F4A93B',

  footerText: '#F4E7EE',
  footerMuted: '#D9BECC',
} as const;

export const FONTS = {
  // Web fonts first; robust fallbacks for email clients that block them.
  display: `'Baloo 2', 'Trebuchet MS', Verdana, sans-serif`,
  sans: `'Hanken Grotesk', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  pdfDisplay: `'Baloo 2', 'Comic Sans MS', 'Trebuchet MS', sans-serif`,
  pdfBody: `'Hanken Grotesk', Georgia, 'Times New Roman', serif`,
} as const;

export const RADIUS = {
  card: '22px',
  pill: '999px',
} as const;

export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap';

/** Four-point sparkle motif (the brand mark), inline SVG. */
export function sparkleSvg(size = 18, color: string = COLORS.berry): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `style="vertical-align:middle" aria-hidden="true">` +
    `<path d="M12 1c.5 5.4 4.6 9.5 10 10-5.4.5-9.5 4.6-10 10-.5-5.4-4.6-9.5-10-10C7.4 10.5 11.5 6.4 12 1Z" ` +
    `fill="${color}"/></svg>`
  );
}
