import { describe, expect, it } from 'vitest';
import { TIERS } from '../types/api';
import { priceFor } from './pricing';

// The price table is the single money source of truth (§8) — pin it so a
// fat-fingered edit can't silently change what customers are charged.
describe('pricing', () => {
  it('charges ₹299 for the pdf tier', () => {
    expect(priceFor('pdf')).toMatchObject({ amount: 29900, currency: 'INR', enabled: true });
  });

  it('prices every tier in whole paise, INR', () => {
    for (const tier of TIERS) {
      const price = priceFor(tier);
      expect(Number.isInteger(price.amount)).toBe(true);
      expect(price.amount).toBeGreaterThan(0);
      expect(price.currency).toBe('INR');
    }
  });

  it('keeps audio tiers disabled until ElevenLabs is live-tested', () => {
    expect(priceFor('pdf_audio_guide').enabled).toBe(false);
    expect(priceFor('seven_day_pack').enabled).toBe(false);
  });

  it('marks exactly the audio-bearing tiers with includesAudio', () => {
    expect(priceFor('pdf').includesAudio).toBe(false);
    expect(priceFor('pdf_audio_guide').includesAudio).toBe(true);
    expect(priceFor('seven_day_pack').includesAudio).toBe(true);
  });
});
