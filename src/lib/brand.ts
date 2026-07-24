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
import { PHOTO_LIKENESS_ENABLED } from './photo-likeness';

export const BRAND = {
  name: 'MoonBell',
  tagline: 'Stories that stay forever.',

  hero: {
    // The h1 leads with the concrete product; the tagline is the eyebrow.
    headline: 'A printed storybook where your child is the hero.',
    sub:
      'A personalised printed hardcover starring your child — illustrated from their nickname, ' +
      'how they look and what they love. Free preview first; ₹999 includes the digital PDF. ' +
      (PHOTO_LIKENESS_ENABLED ? 'Photo optional — used once, then deleted.' : 'No photos required.'),
    primaryCta: 'Create a free preview',
    secondaryCta: 'Read a sample story',
    trustLine: PHOTO_LIKENESS_ENABLED
      ? 'Free preview · Photo optional · Pay only when you love it'
      : 'Free preview · No photos · Pay only when you love it',
    // Concrete spec line for the hero — what it is, who it's for, what it costs.
    specLine: 'A personalised printed hardcover · ages 3–10 · ₹999 incl. the digital PDF · free preview first',
    // Default name shown on the interactive hero cover before a parent types.
    sampleName: 'Aarav',
    sampleTitleSuffix: 'and the Star That Listens',
  },

  /** The main product: a printed hardcover (founder-fulfilled) that includes the
   * digital PDF. ₹999 is the confirmed launch price (server truth: pricing.ts).
   * Page count truth: 8/10/12 interior pages by reading level, plus the cover —
   * never claim more (pipeline/helpers.ts pageCountFor). */
  product: {
    name: 'Personalised Printed Storybook',
    price: 999,
    priceLabel: '₹999',
    currency: 'INR',
    pages: 'Up to 12 illustrated pages',
    ageRange: 'Ages 3–10',
    format: 'Printed hardcover',
    delivery: 'Printed & dispatched in ~7 days',
    revision: 'One free preview tweak',
    unlockCta: 'Order the printed book',
    includes: [
      'A printed hardcover, shipped to your door',
      'The digital PDF, ready within the hour — usually much sooner',
      'Personalised cover with your child as the hero',
      'Up to 12 illustrated pages, matched to their reading level',
      'One free tweak — change the details and we regenerate',
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
