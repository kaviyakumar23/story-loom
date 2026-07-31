/**
 * Consent versions we are prepared to stand behind.
 *
 * The version string is the only record of WHICH policy a parent agreed to, so
 * it has to name a policy that actually existed. Accepting any string meant a
 * stale client — or a forged one — could file consent against a version that was
 * never published, and a later "what did they agree to?" would have no answer.
 *
 * Bump the current version whenever the policy changes what we collect or how we
 * use it, and leave the superseded entries here: old records must stay readable.
 */
export const CONSENT_VERSIONS = {
  book_creation: ['2026-01-policy-v1', '2026-08-beta-v1'],
  photo_likeness: ['2026-08-photo-v1'],
} as const;

export type ConsentScope = keyof typeof CONSENT_VERSIONS;

/** The version a new consent should be recorded against, per scope. */
export const CURRENT_CONSENT_VERSION: Record<ConsentScope, string> = {
  book_creation: '2026-08-beta-v1',
  photo_likeness: '2026-08-photo-v1',
};

export function isKnownConsentVersion(scope: string, version: string): boolean {
  const known = CONSENT_VERSIONS[scope as ConsentScope];
  return known != null && (known as readonly string[]).includes(version);
}
