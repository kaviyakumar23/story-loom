/**
 * Name tokenization (§6, §9 — a load-bearing design decision).
 *
 * The child's real name (and any other identifying free text) is replaced with
 * a stable placeholder BEFORE anything leaves our system to a third-party AI
 * vendor, and re-injected only at the final local render. The real name never
 * reaches a model API. This also reduces cross-border-transfer exposure.
 *
 * Phase 1 fulfils books manually, so no AI call happens yet — but per §16 this
 * utility exists and is wired from day one so the automated pipeline (Phase 2)
 * cannot accidentally send a real name. Treat `tokenizeOutbound` as the only
 * sanctioned way to build a prompt that contains hero text.
 */

export const HERO_TOKEN = '{{HERO}}';

export interface TokenMap {
  /** placeholder -> real value, used to re-inject locally at render time. */
  [placeholder: string]: string;
}

/**
 * Replace the hero's real name with {{HERO}} in arbitrary text. Returns the
 * tokenized text plus the map needed to reverse it locally.
 */
export function tokenizeOutbound(
  text: string,
  realName: string,
): { text: string; map: TokenMap } {
  const map: TokenMap = { [HERO_TOKEN]: realName };
  if (!realName.trim()) return { text, map };
  // Word-boundary, case-insensitive replacement of the name.
  const pattern = new RegExp(`\\b${escapeRegExp(realName)}\\b`, 'gi');
  return { text: text.replace(pattern, HERO_TOKEN), map };
}

/**
 * Scrub a single free-text value of the hero's real name, replacing it with the
 * placeholder. Use on ANY parent-supplied free text that flows to a model —
 * interests, avatar feature tokens — not just the name field (§9). A parent may
 * type the child's name into an interest; this stops it reaching a vendor.
 */
export function scrub(text: string, realName: string): string {
  if (!realName.trim()) return text;
  return text.replace(new RegExp(`\\b${escapeRegExp(realName)}\\b`, 'gi'), HERO_TOKEN);
}

/** Scrub every value in a list. */
export function scrubAll(values: string[], realName: string): string[] {
  return values.map((v) => scrub(v, realName));
}

/** Re-inject real values into tokenized text. Local render only — never sent out. */
export function detokenizeLocal(text: string, map: TokenMap): string {
  let out = text;
  for (const [placeholder, value] of Object.entries(map)) {
    out = out.split(placeholder).join(value);
  }
  return out;
}

/**
 * Guard for outbound payloads: throws if a known sensitive value is still
 * present. Call this immediately before any third-party model request.
 */
export function assertNoSensitive(payload: string, sensitive: string[]): void {
  for (const value of sensitive) {
    if (!value.trim()) continue;
    if (new RegExp(`\\b${escapeRegExp(value)}\\b`, 'i').test(payload)) {
      throw new Error(
        'Refusing outbound request: sensitive value present in payload. ' +
          'All identifying text must be tokenized first (see lib/tokenize).',
      );
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
