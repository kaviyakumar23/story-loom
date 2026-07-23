/**
 * Optional child-photo likeness is gated by this build-time flag (default OFF).
 *
 * Import it anywhere that makes a public claim about photos, so the copy stays
 * HONEST IN BOTH STATES: flag OFF → "no photos"; flag ON → "photo optional, used
 * once, then deleted — never printed, never shared". A single un-updated
 * "no photos, ever" line becomes a false statement the moment the flag flips.
 * See memory/photo-likeness-flag-state for the enable checklist.
 */
export const PHOTO_LIKENESS_ENABLED = process.env.NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED === 'true';

/** Consistent one-liner for the "photo optional" state, reused across surfaces. */
export const PHOTO_OPTIONAL_BLURB =
  'If you add a photo, it’s used once to shape the illustrated character, then deleted — never printed, never shared.';
