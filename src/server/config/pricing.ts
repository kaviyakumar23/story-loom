import type { Tier } from '../types/api';

/**
 * Authoritative price table (§8 — "never trust client-supplied amounts").
 * Amounts are in the currency's smallest unit (paise for INR), matching what
 * Razorpay expects.
 */
export interface PriceEntry {
  amount: number;
  currency: string;
  /** Whether this tier includes audio narration (drives fulfillment later). */
  includesAudio: boolean;
  /** Physical tier — requires a shipping address and creates a print fulfilment. */
  physical: boolean;
  /**
   * Purchasable right now. Keep client TIER_META (src/lib/types.ts) in sync —
   * pricing-sync.test.ts fails if they drift.
   */
  enabled: boolean;
}

/**
 * The two prices under test.
 *
 * ₹999 is gone. At the plan's own cost assumptions it leaves almost nothing
 * once acquisition is counted, so testing it would only tell us that people
 * like cheap books. These two are the range where a printed, personalised
 * hardcover can actually pay for itself.
 */
export type PriceArm = 'A' | 'B';
export const PRICE_ARMS: PriceArm[] = ['A', 'B'];
const PRINT_ARM_AMOUNT: Record<PriceArm, number> = { A: 129900, B: 149900 };
export const DEFAULT_PRICE_ARM: PriceArm = 'A';

export const PRICE_TABLE: Record<Tier, PriceEntry> = {
  // The beta sells one thing. A cheaper digital option sitting beside the
  // hardcover would answer a question nobody is asking — whether people prefer
  // paying less — and take the sample with it.
  pdf: { amount: 29900, currency: 'INR', includesAudio: false, physical: false, enabled: false },
  pdf_audio_guide: { amount: 49900, currency: 'INR', includesAudio: true, physical: false, enabled: false },
  seven_day_pack: { amount: 99900, currency: 'INR', includesAudio: true, physical: false, enabled: false },
  // The product. Price comes from the visitor's assigned arm; the amount here is
  // the default for anything that asks without one.
  print: {
    amount: PRINT_ARM_AMOUNT[DEFAULT_PRICE_ARM],
    currency: 'INR',
    includesAudio: false,
    physical: true,
    enabled: true,
  },
};

/**
 * The price for a tier, at this visitor's arm.
 *
 * Only the printed book is under test — the disabled tiers have no arm, and
 * passing one for them is meaningless rather than an error.
 */
export function priceFor(tier: Tier, arm: PriceArm = DEFAULT_PRICE_ARM): PriceEntry {
  const entry = PRICE_TABLE[tier];
  if (tier !== 'print') return entry;
  return { ...entry, amount: PRINT_ARM_AMOUNT[arm] ?? PRINT_ARM_AMOUNT[DEFAULT_PRICE_ARM] };
}

/** Display price for an arm, e.g. "₹1,299". */
export function formatPrice(amountPaise: number, currency = 'INR'): string {
  const major = amountPaise / 100;
  if (currency !== 'INR') return `${major} ${currency}`;
  return `₹${major.toLocaleString('en-IN')}`;
}

export function priceForArm(arm: PriceArm): { amount: number; display: string } {
  const amount = PRINT_ARM_AMOUNT[arm] ?? PRINT_ARM_AMOUNT[DEFAULT_PRICE_ARM];
  return { amount, display: formatPrice(amount) };
}
