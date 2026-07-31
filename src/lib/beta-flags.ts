/**
 * Client mirror of the narrow-paid-beta switches (server side:
 * `src/server/config/beta-flags.ts`).
 *
 * These are inlined at build time, so they decide only what the UI OFFERS — the
 * server flag of the same name is what actually enforces each rule. Keep them in
 * step: a control that is visible but refused is a worse experience than one
 * that was never shown.
 */
export const PUBLIC_SHARING_ENABLED = process.env.NEXT_PUBLIC_PUBLIC_SHARING_ENABLED === 'true';

/**
 * Self-serve changes after purchase (per-page text edits and paid image
 * re-renders). Off for the beta: every correction goes through one founder
 * review instead, so nothing reaches the printer unseen.
 */
export const SELF_SERVE_EDITING_ENABLED = process.env.NEXT_PUBLIC_SELF_SERVE_EDITING_ENABLED === 'true';

/** Whether a printed order also delivers a downloadable copy. */
export const DIGITAL_COMPANION_ENABLED = process.env.NEXT_PUBLIC_DIGITAL_COMPANION_ENABLED === 'true';

/**
 * Curated occasion packs (the "first day of school", "new sibling" shortcuts).
 * Off for the beta: the cohort is one product with one story brief, and eight
 * entry points would split a 75-order sample into meaningless slices.
 */
export const OCCASION_PACKS_ENABLED = process.env.NEXT_PUBLIC_OCCASION_PACKS_ENABLED === 'true';
