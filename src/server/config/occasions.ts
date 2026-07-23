import type { OccasionPackId } from '../types/api';

/**
 * Founder-maintained occasion calendar for reminder emails. Dates are explicit
 * per year (Indian festivals move), so ADD next year's entries before they pass —
 * a stale year simply stops matching. The 21-day lead makes the reminder a real
 * service, not spam: a printed book takes ~7 days to arrive, so a parent who
 * orders on the nudge still gets it in time.
 *
 * Per-hero birthdays are NOT listed here — the cron derives them from
 * heroes.birth_month (month only) and nudges a month ahead.
 */
export interface Occasion {
  /** Stable, year-scoped, unique — used for per-parent/hero dedupe. */
  key: string;
  label: string;
  year: number;
  month: number; // 1-12
  day: number;
  /** Optional curated pack to preselect via the ?pack= deep link. */
  pack?: OccasionPackId;
  /** Send the reminder this many days before the date. */
  leadDays: number;
}

export const OCCASIONS: Occasion[] = [
  { key: 'raksha-bandhan-2026', label: 'Raksha Bandhan', year: 2026, month: 8, day: 9, pack: 'new_sibling', leadDays: 21 },
  { key: 'diwali-2026', label: 'Diwali', year: 2026, month: 11, day: 8, leadDays: 21 },
  { key: 'childrens-day-2026', label: 'Children’s Day', year: 2026, month: 11, day: 14, leadDays: 18 },
];

const DAY_MS = 86_400_000;
/** Cron-miss tolerance: fire if within this many days of the ideal lead day. */
const WINDOW_DAYS = 3;

/** Occasions whose reminder window is open on `today`. */
export function dueOccasions(today: Date): Occasion[] {
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return OCCASIONS.filter((o) => {
    const target = Date.UTC(o.year, o.month - 1, o.day);
    const daysUntil = Math.floor((target - todayUTC) / DAY_MS);
    return daysUntil <= o.leadDays && daysUntil > o.leadDays - WINDOW_DAYS;
  });
}
