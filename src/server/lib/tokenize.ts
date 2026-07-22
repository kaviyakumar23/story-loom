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
  return { text: text.replace(namePattern(realName), HERO_TOKEN), map };
}

/**
 * Scrub a single free-text value of the hero's real name, replacing it with the
 * placeholder. Use on ANY parent-supplied free text that flows to a model —
 * interests, avatar feature tokens — not just the name field (§9). A parent may
 * type the child's name into an interest; this stops it reaching a vendor.
 */
export function scrub(text: string, realName: string): string {
  if (!realName.trim()) return text;
  return text.replace(namePattern(realName), HERO_TOKEN);
}

/** Scrub every value in a list. */
export function scrubAll(values: string[], realName: string): string[] {
  return values.map((v) => scrub(v, realName));
}

/**
 * Read the placeholder as prose. For payloads that must stay free of the real
 * name (illustration prompts) but shouldn't carry a raw `{{HERO}}` either — a
 * model given the literal token may letter it into the picture.
 */
export function humanizeHeroToken(text: string): string {
  return text.split(HERO_TOKEN).join('the hero child');
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
 * Detect high-confidence personal data *patterns* in free text — the indirect
 * leaks a nickname-only guard misses (a parent typing an email, phone, address
 * fragment, or ID into an interest/goal/revision field). Returns the kinds
 * found; empty means clean. Deliberately tuned to avoid tripping on ordinary
 * story attributes (age bands like "3-4", short page counts), so it only fires
 * on things that should never appear in a child's story input.
 */
export function detectSensitivePatterns(text: string): string[] {
  const found = new Set<string>();
  if (/[\w.+-]+@[\w-]+\.[\w][\w.-]*/.test(text)) found.add('email');
  if (/\bhttps?:\/\/|\bwww\.[\w-]/i.test(text)) found.add('url');
  // Phone / long ID: a run of digits (allowing spaces, dashes, +, ()) whose
  // digit count is >= 10 — e.g. "+91 98765 43210", "(080) 4123 4567".
  for (const m of text.matchAll(/\d[\d\s\-+()]{6,}\d/g)) {
    if (m[0].replace(/\D/g, '').length >= 10) { found.add('phone_or_id'); break; }
  }
  // Standalone long numeric run (DOB as digits, Aadhaar/PAN-like, order numbers).
  if (/\d{7,}/.test(text)) found.add('long_number');
  return [...found];
}

/**
 * Guard for outbound payloads: throws if a known sensitive value is still
 * present, OR if a personal-data pattern (email/phone/URL/long ID) survived
 * into the payload. Call this immediately before any third-party model request.
 */
export function assertNoSensitive(payload: string, sensitive: string[]): void {
  for (const value of sensitive) {
    if (!value.trim()) continue;
    if (namePattern(value, '').test(payload)) {
      throw new Error(
        'Refusing outbound request: sensitive value present in payload. ' +
          'All identifying text must be tokenized first (see lib/tokenize).',
      );
    }
  }
  const patterns = detectSensitivePatterns(payload);
  if (patterns.length) {
    throw new Error(
      `Refusing outbound request: possible personal data in payload (${patterns.join(', ')}). ` +
        'Free-text input must be sanitised before egress (see lib/tokenize).',
    );
  }
}

/**
 * Case-insensitive matcher for a name. `\b` is ASCII-word based, so it is
 * applied per edge and only where it can match: a name ending in punctuation
 * ("Anu (junior)") or written in an Indic script would otherwise silently
 * never match — and leak to vendors. Over-matching is the safe direction here.
 */
function namePattern(name: string, flags = 'g'): RegExp {
  const lead = /^\w/.test(name) ? '\\b' : '';
  const trail = /\w$/.test(name) ? '\\b' : '';
  return new RegExp(`${lead}${escapeRegExp(name)}${trail}`, `${flags}i`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
