import { describe, expect, it } from 'vitest';
import { assertNoSensitive, detokenizeLocal, HERO_TOKEN, scrub, scrubAll, tokenizeOutbound } from './tokenize';

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

  it('assertNoSensitive throws when a real name leaks into a payload', () => {
    expect(() => assertNoSensitive('a story about Aarav', ['Aarav'])).toThrow(/tokenized/);
    expect(() => assertNoSensitive(`a story about ${HERO_TOKEN}`, ['Aarav'])).not.toThrow();
  });
});
