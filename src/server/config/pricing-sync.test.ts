import { describe, expect, it } from 'vitest';
import { TIER_META, TIER_ORDER, type Tier } from '@/lib/types';
import { PRICE_ARMS, PRICE_TABLE, formatPrice, priceFor, priceForArm } from './pricing';

/**
 * The server prices; the client only labels. Nothing enforced that before — the
 * two tables were kept in step by a comment asking nicely, and the flagship
 * product's price was not covered by a single test. A tier shown as buyable but
 * refused at checkout, or shown at a price we do not charge, is the kind of bug
 * a customer finds first.
 */
describe('pricing tables stay in step', () => {
  it('agrees on which tiers are buyable', () => {
    for (const tier of Object.keys(PRICE_TABLE) as Tier[]) {
      expect(TIER_META[tier].enabled, `enabled flag for ${tier}`).toBe(PRICE_TABLE[tier].enabled);
    }
  });

  it('agrees on which tier is physical', () => {
    for (const tier of Object.keys(PRICE_TABLE) as Tier[]) {
      expect(Boolean(TIER_META[tier].physical), `physical flag for ${tier}`).toBe(PRICE_TABLE[tier].physical);
    }
  });

  it('shows a price for every fixed-price tier, and none for the tested one', () => {
    for (const tier of Object.keys(PRICE_TABLE) as Tier[]) {
      if (tier === 'print') {
        // Under test: a constant here would be wrong for half of visitors.
        expect(TIER_META[tier].price).toBeUndefined();
      } else {
        expect(TIER_META[tier].price, `display price for ${tier}`).toBe(formatPrice(PRICE_TABLE[tier].amount));
      }
    }
  });

  it('lists every tier in the display order', () => {
    expect([...TIER_ORDER].sort()).toEqual((Object.keys(PRICE_TABLE) as Tier[]).sort());
  });

  it('sells exactly one thing during the beta', () => {
    const buyable = (Object.keys(PRICE_TABLE) as Tier[]).filter((t) => PRICE_TABLE[t].enabled);
    expect(buyable).toEqual(['print']);
  });
});

describe('price arms', () => {
  it('prices the printed book from the visitor’s arm', () => {
    expect(priceFor('print', 'A').amount).toBe(129900);
    expect(priceFor('print', 'B').amount).toBe(149900);
  });

  it('formats Indian amounts the way a buyer reads them', () => {
    expect(priceForArm('A').display).toBe('₹1,299');
    expect(priceForArm('B').display).toBe('₹1,499');
  });

  // ₹999 leaves almost nothing once acquisition is counted, so testing it would
  // only prove that people like cheap books.
  it('no longer offers the old ₹999 price', () => {
    for (const arm of PRICE_ARMS) {
      expect(priceForArm(arm).amount).toBeGreaterThan(99900);
    }
  });

  it('falls back to a real price when handed a nonsense arm', () => {
    expect(priceFor('print', 'Z' as never).amount).toBe(129900);
  });
});
