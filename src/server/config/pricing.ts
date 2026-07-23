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
  /** Physical tier — requires a shipping address and creates a print fulfilment. */
  physical: boolean;
  /**
   * Purchasable right now. Audio tiers stay off until ELEVENLABS_API_KEY is
   * live-tested; keep client TIER_META (src/lib/types.ts) in sync.
   */
  enabled: boolean;
}

const PRICE_TABLE: Record<Tier, PriceEntry> = {
  pdf: { amount: 29900, currency: 'INR', includesAudio: false, physical: false, enabled: true },
  pdf_audio_guide: { amount: 49900, currency: 'INR', includesAudio: true, physical: false, enabled: false },
  seven_day_pack: { amount: 99900, currency: 'INR', includesAudio: true, physical: false, enabled: false },
  // Main product: printed hardcover, founder-fulfilled, includes the instant
  // digital PDF. ₹999 confirmed as the launch price (2026-07); re-check margin
  // once the print vendor's per-unit cost is known, and keep TIER_META in sync.
  print: { amount: 99900, currency: 'INR', includesAudio: false, physical: true, enabled: true },
};

export function priceFor(tier: Tier): PriceEntry {
  return PRICE_TABLE[tier];
}
