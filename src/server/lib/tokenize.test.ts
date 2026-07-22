import { describe, expect, it } from 'vitest';
import { assertNoSensitive, detectSensitivePatterns, detokenizeLocal, humanizeHeroToken, HERO_TOKEN, scrub, scrubAll, tokenizeOutbound } from './tokenize';

// Tokenization is the guarantee that a child's real name never reaches an AI
// vendor (§9) — test it like the safety boundary it is.
describe('tokenize', () => {
  it('replaces the name case-insensitively on word boundaries', () => {
    const { text } = tokenizeOutbound(`Aarav and AARAV love Aarav's kite. Karavan stays.`, 'Aarav');
    expect(text).toBe(`${HERO_TOKEN} and ${HERO_TOKEN} love ${HERO_TOKEN}'s kite. Karavan stays.`);
  });

  it('round-trips through detokenizeLocal', () => {
    const { text, map } = tokenizeOutbound('Aarav rides to school.', 'Aarav');
    expect(detokenizeLocal(text, map)).toBe('Aarav rides to school.');
  });

  it('scrubs names a parent typed into free text like interests', () => {
    expect(scrubAll(['dinosaurs', 'playing with Mira'], 'Mira')).toEqual(['dinosaurs', `playing with ${HERO_TOKEN}`]);
  });

  it('survives names containing regex metacharacters', () => {
    expect(scrub('Anu (junior) laughs', 'Anu (junior)')).toBe(`${HERO_TOKEN} laughs`);
  });

  it('scrubs names written in Indic scripts (\\b never matches next to them)', () => {
    expect(scrub('आरव खेलता है', 'आरव')).toBe(`${HERO_TOKEN} खेलता है`);
  });

  it('leaves text alone when the name is blank', () => {
    expect(scrub('hello there', '  ')).toBe('hello there');
  });

  it('humanizes the token for image prompts, leaking no real name', () => {
    expect(humanizeHeroToken(`${HERO_TOKEN} waves at the school gate`)).toBe(
      'the hero child waves at the school gate',
    );
    expect(humanizeHeroToken('nothing to do here')).toBe('nothing to do here');
  });

  it('assertNoSensitive throws when a real name leaks into a payload', () => {
    expect(() => assertNoSensitive('a story about Aarav', ['Aarav'])).toThrow(/tokenized/);
    expect(() => assertNoSensitive(`a story about ${HERO_TOKEN}`, ['Aarav'])).not.toThrow();
  });

  it('detectSensitivePatterns flags email / phone / url / long numbers', () => {
    expect(detectSensitivePatterns('reach me at parent@example.com')).toContain('email');
    expect(detectSensitivePatterns('call +91 98765 43210 please')).toContain('phone_or_id');
    expect(detectSensitivePatterns('see https://example.in/x')).toContain('url');
    expect(detectSensitivePatterns('reference 12345678')).toContain('long_number');
  });

  it('detectSensitivePatterns leaves ordinary story input clean', () => {
    expect(detectSensitivePatterns('loves cricket, space and dinosaurs')).toHaveLength(0);
    // Age bands and short page counts must not trip it.
    expect(detectSensitivePatterns('a 3-4 year old, 16-20 pages')).toHaveLength(0);
  });

  it('assertNoSensitive throws on free-text PII patterns even with no known name', () => {
    expect(() => assertNoSensitive('email me at a@b.co', [])).toThrow(/personal data/);
    expect(() => assertNoSensitive('a gentle story about the moon and a bell', [])).not.toThrow();
  });
});
