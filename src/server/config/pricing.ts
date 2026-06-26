import type { Tier } from '../types/api';

/**
 * Authoritative price table (§8 — "never trust client-supplied amounts").
 * Amounts are in the currency's smallest unit (paise for INR), matching what
 * Razorpay expects. Config-driven (§14); replace with a DB/remote-config lookup
 * if prices need to change without a deploy.
 */
export interface PriceEntry {
  amount: number;
  currency: string;
  /** Whether this tier includes audio narration (drives fulfillment later). */
  includesAudio: boolean;
}

const PRICE_TABLE: Record<Tier, PriceEntry> = {
  pdf: { amount: 29900, currency: 'INR', includesAudio: false },
  pdf_audio_guide: { amount: 49900, currency: 'INR', includesAudio: true },
  seven_day_pack: { amount: 99900, currency: 'INR', includesAudio: true },
};

export function priceFor(tier: Tier): PriceEntry {
  return PRICE_TABLE[tier];
}
