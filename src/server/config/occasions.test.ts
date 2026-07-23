import { describe, expect, it } from 'vitest';
import { dueOccasions, OCCASIONS } from './occasions';

/** Build a UTC date at noon so the date-only math is unambiguous. */
function day(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

describe('dueOccasions', () => {
  const rb = OCCASIONS.find((o) => o.key === 'raksha-bandhan-2026')!; // Aug 9 2026, leadDays 21

  it('fires exactly on the ideal lead day (21 days before)', () => {
    const keys = dueOccasions(day('2026-07-19')).map((o) => o.key); // Aug 9 − 21 = Jul 19
    expect(keys).toContain('raksha-bandhan-2026');
  });

  it('still fires within the 3-day catch-up window (cron-miss tolerance)', () => {
    // daysUntil 19, 20 also qualify (> leadDays - 3), i.e. Jul 20 and Jul 21.
    expect(dueOccasions(day('2026-07-21')).map((o) => o.key)).toContain('raksha-bandhan-2026');
  });

  it('does NOT fire once inside the window (too close to the date)', () => {
    // Jul 23 → 17 days out, which is < leadDays-3 (18): the send window has passed.
    expect(dueOccasions(day('2026-07-23')).map((o) => o.key)).not.toContain('raksha-bandhan-2026');
  });

  it('does NOT fire before the window opens (too early)', () => {
    expect(dueOccasions(day('2026-07-10')).map((o) => o.key)).not.toContain('raksha-bandhan-2026');
  });

  it('does NOT fire after the date has passed', () => {
    expect(dueOccasions(day('2026-08-10')).map((o) => o.key)).not.toContain('raksha-bandhan-2026');
  });

  it('is year-scoped — 2026 entries never fire in a later year', () => {
    // Same Jul 19 calendar day, but in 2027 the 2026 targets are long past.
    expect(dueOccasions(day('2027-07-19'))).toHaveLength(0);
    expect(rb.leadDays).toBe(21);
  });
});
