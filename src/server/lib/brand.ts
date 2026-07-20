/**
 * MoonBell brand tokens — single source of truth for the backend-rendered
 * surfaces: transactional emails (lib/email.ts) and the PDF storybook
 * (lib/pdf.ts). Mirrors the frontend CSS variables in app/globals.css so email,
 * PDF, and app feel like one product. (Marketing copy/price live in lib/brand.ts.)
 *
 * Aesthetic: warm, premium, storybook — Paper Cream paper, Moon Indigo brand,
 * Bell Gold + Story Coral accents, Playfair Display headings + Nunito body.
 */
export const COLORS = {
  bg: '#FFF9F0', // Paper Cream — page
  bg2: '#EFEEFF', // Moon Mist — band
  surface: '#FFFFFF', // Cloud White — card
  ink: '#242340', // Night Ink
  inkSoft: '#4B4A5A', // Soft Charcoal — secondary
  hairline: '#E4E2F5', // soft indigo border

  berry: '#5653C6', // brand (Moon Indigo)
  plum: '#3B378F', // brand-deep (footer)
  brandTint: '#EFEEFF',
  teal: '#6E6AD6', // eyebrow (lighter indigo)
  coral: '#FF7C70', // accent / action (Story Coral)
  coralDeep: '#E8604F', // sticker shadow
  gold: '#F5C85B', // Bell Gold

  footerText: '#EAE8FB',
  footerMuted: '#C9C7EA',
} as const;

export const FONTS = {
  // Web fonts first; robust fallbacks for email clients / PDF that block them.
  display: `'Playfair Display', Georgia, 'Times New Roman', serif`,
  sans: `'Nunito', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  pdfDisplay: `'Playfair Display', Georgia, 'Times New Roman', serif`,
  pdfBody: `'Nunito', Helvetica, Arial, sans-serif`,
} as const;

export const RADIUS = {
  card: '22px',
  pill: '999px',
} as const;

export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Nunito:wght@400;500;600;700;800&display=swap';

/** Four-point sparkle motif (the brand mark), inline SVG. */
export function sparkleSvg(size = 18, color: string = COLORS.berry): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `style="vertical-align:middle" aria-hidden="true">` +
    `<path d="M12 1c.5 5.4 4.6 9.5 10 10-5.4.5-9.5 4.6-10 10-.5-5.4-4.6-9.5-10-10C7.4 10.5 11.5 6.4 12 1Z" ` +
    `fill="${color}"/></svg>`
  );
}
