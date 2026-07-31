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
