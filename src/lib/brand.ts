/**
 * MoonBell brand + product config — the ONE place to change the name, tagline,
 * marketing copy, and the launch product's price/details. Nothing user-facing
 * should hard-code these. Change the name here and it updates everywhere
 * (header, footer, metadata, emails via business.ts, homepage, funnel).
 *
 * Palette + type live as CSS variables in globals.css (and mirrored for
 * email/PDF in server/lib/brand.ts). The hexes here are for the rare spot that
 * needs a colour in TS (e.g. an inline SVG); prefer the CSS vars in components.
 */
export const BRAND = {
  name: 'MoonBell',
  tagline: 'Stories that stay forever.',

  hero: {
    headline: 'Their imagination. Their adventure. Their very own book.',
    sub:
      'Create a beautifully illustrated story starring your child — made from their nickname, ' +
      'appearance, interests and the lesson you want to share. No photos required.',
    primaryCta: 'Create a free preview',
    secondaryCta: 'Read a sample story',
    trustLine: 'Free preview · No photos · Pay only when you love it',
    // Concrete spec line for the hero — what it is, who it's for, what it costs.
    specLine: 'A personalised printed hardcover · ages 3–10 · ₹999, incl. instant digital · free preview first',
    // Default name shown on the interactive hero cover before a parent types.
    sampleName: 'Aarav',
    sampleTitleSuffix: 'and the Star That Listens',
  },

  /** The main product: a printed hardcover (founder-fulfilled) that includes the
   * instant digital PDF. PLACEHOLDER price ₹999 — confirm before launch. */
  product: {
    name: 'Personalised Printed Storybook',
    price: 999,
    priceLabel: '₹999',
    currency: 'INR',
    pages: '16–20 pages',
    ageRange: 'Ages 3–10',
    format: 'Printed hardcover',
    delivery: 'Printed & shipped in ~7 days',
    revision: 'One free revision',
    unlockCta: 'Order the printed book',
    includes: [
      'A printed hardcover, shipped to your door',
      'The instant digital PDF, ready the moment you order',
      'Personalised cover with your child as the hero',
      '16–20 illustrated pages',
      'One free revision',
    ],
  },

  /** MoonBell palette (reference; components should use the CSS vars). */
  palette: {
    moonIndigo: '#5653C6',
    nightInk: '#242340',
    bellGold: '#F5C85B',
    storyCoral: '#FF7C70',
    paperCream: '#FFF9F0',
    moonMist: '#EFEEFF',
    cloudWhite: '#FFFFFF',
    softCharcoal: '#4B4A5A',
  },
} as const;

export type Brand = typeof BRAND;
