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
    headline: 'A hardcover storybook created especially for your child.',
    sub:
      'A personalised printed hardcover starring your child — written and illustrated from their ' +
      'personality, what they love, and the adventure you choose. ' +
      (PHOTO_LIKENESS_ENABLED ? 'Photo optional — used once, then deleted.' : 'No photo of your child needed.'),
    primaryCta: 'Create my free preview',
    secondaryCta: 'See the sample book',
    // What it costs the visitor to try. The PRICE is deliberately absent — it is
    // under test, so it is fetched per visitor rather than baked in here where
    // it would be wrong for half of them.
    ctaMicrocopy: 'About 3 minutes · no child photo · no payment until you see the preview',
    trustLine: PHOTO_LIKENESS_ENABLED
      ? 'Free preview · Photo optional · Pay only when you love it'
      : 'Free preview · No child photos · Pay only when you love it',
    // Default name shown on the interactive hero cover before a parent types.
    sampleName: 'Aarav',
    sampleTitleSuffix: 'and the Star That Listens',
  },

  /**
   * The product, as facts that must stay true.
   *
   * Every claim here is checked against something: the page count against
   * print-spec.ts, the format against what the printer is quoted, the delivery
   * window against the fulfilment SLA. There is no `price` — the beta is testing
   * two, so the amount is fetched per visitor from /api/v1/beta/pricing.
   *
   * The digital PDF is NOT included. It was, and saying so is now false: a
   * printed order ships a book and nothing else while the beta runs.
   */
  product: {
    name: 'Personalised Printed Storybook',
    currency: 'INR',
    pages: '20 pages · 12 illustrated',
    ageRange: 'Ages 3–7',
    format: 'Printed hardcover, 8×8 in casebound',
    spec: '8×8 in casebound hardcover · 20 pages · ages 3–7',
    delivery: 'Dispatched within 7 working days',
    deliveryWindow: 'Delivered within 14 working days',
    revision: 'One change, reviewed by us',
    unlockCta: 'Order the printed book',
    includes: [
      'A printed hardcover, shipped to your door',
      'Personalised cover with your child as the hero',
      '12 illustrated pages, written for their reading level',
      'A dedication page in your own words',
      'Checked by a person before it prints',
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
