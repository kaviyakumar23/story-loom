import { loadEnv } from './env';

/**
 * Feature switches for the narrow paid beta.
 *
 * The beta deliberately sells ONE thing — an invite-only printed hardcover — so
 * everything that is not that is switched off here rather than deleted. Each
 * reader below is the single runtime authority for its feature: routes, the
 * pipeline and the UI all ask this module, so "is X off?" has exactly one
 * answer and turning X back on after the beta is a one-line change.
 *
 * These are read at request time (never inlined at build time like a
 * NEXT_PUBLIC_ var), so flipping one in the host env takes effect on the next
 * request without a redeploy.
 */
function on(value: string): boolean {
  return value === 'true';
}

/**
 * Child-photo likeness. Runtime authority — the NEXT_PUBLIC_ twin only decides
 * whether the uploader renders. Both must be on for a photo to be accepted, so
 * the server can refuse photos even while a stale build still shows the UI.
 */
export function photoLikenessEnabled(): boolean {
  const env = loadEnv();
  return on(env.PHOTO_LIKENESS_SERVER_ENABLED) && on(env.NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED);
}

/** Preview win-back and occasion-nudge sends. Transactional mail is unaffected. */
export function marketingEmailsEnabled(): boolean {
  return on(loadEnv().MARKETING_EMAILS_ENABLED);
}

/**
 * Whether a physical order also delivers a digital copy. Off for the beta: the
 * hardcover IS the product, so the assembled PDF exists only as the print master
 * and is never signed for the parent. The tests being run are "will a stranger
 * pay for a printed book" and "can we deliver one" — a downloadable copy would
 * blur both.
 */
export function digitalCompanionEnabled(): boolean {
  return on(loadEnv().DIGITAL_COMPANION_ENABLED);
}

/**
 * Shareable preview links. Off for the beta: a link that forwards a child's
 * story to anyone who holds it is exactly the surface the capped cohort is
 * meant to avoid, and the plan lists public sharing as out of scope.
 */
export function publicSharingEnabled(): boolean {
  return on(loadEnv().PUBLIC_SHARING_ENABLED);
}

/**
 * Self-serve changes after purchase — per-page text edits and paid image
 * re-renders. Off for the beta: a single founder-reviewed correction replaces
 * them, so no wording or artwork reaches the printer without a human seeing it.
 */
export function selfServeEditingEnabled(): boolean {
  return on(loadEnv().SELF_SERVE_EDITING_ENABLED);
}
