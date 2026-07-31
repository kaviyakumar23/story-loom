import { requireAdmin } from '@/server/auth';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The funnel, per price arm.
 *
 * The whole point of running two prices is comparing what happens after each —
 * so this reports the same ladder twice rather than one blended number that
 * would hide the difference it exists to find.
 *
 * The plan caps valid previews per arm at 200; `previewsPerArm` is what that is
 * measured against, so the experiment can be stopped before it drifts.
 */
const LADDER = [
  'landing_view',
  'cta_click',
  'preview_start',
  'preview_complete',
  'checkout_open',
  'payment_initiated',
  'purchase',
] as const;

export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    const days = Math.min(120, Math.max(1, Number(url.searchParams.get('days') ?? 30)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const db = serviceClient();

    const { data } = await db
      .from('funnel_events')
      .select('event, arm, session_id, props')
      .gte('created_at', since)
      .limit(50_000);
    const rows = (data ?? []) as { event: string; arm: 'A' | 'B' | null; session_id: string | null; props: Record<string, unknown> }[];

    // Count PEOPLE, not events: someone who clicks three CTAs is one visitor
    // considering it, and counting the clicks would make the funnel look wider
    // than the number of humans in it.
    const uniques = new Map<string, Set<string>>();
    const totals = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.arm ?? '?'}|${r.event}`;
      totals.set(key, (totals.get(key) ?? 0) + 1);
      if (r.session_id) {
        const set = uniques.get(key) ?? new Set<string>();
        set.add(r.session_id);
        uniques.set(key, set);
      }
    }

    const arms = ['A', 'B', '?'] as const;
    const funnel = arms.map((arm) => {
      const steps = LADDER.map((event) => ({
        event,
        visitors: uniques.get(`${arm}|${event}`)?.size ?? 0,
        events: totals.get(`${arm}|${event}`) ?? 0,
      }));
      const landings = steps[0].visitors;
      const purchases = steps[steps.length - 1].events;
      const previews = steps.find((s) => s.event === 'preview_complete')?.visitors ?? 0;
      return {
        arm,
        steps,
        // The number the plan's stop/continue thresholds are read against.
        previewToPaid: previews ? Number(((purchases / previews) * 100).toFixed(1)) : null,
        landingToPaid: landings ? Number(((purchases / landings) * 100).toFixed(1)) : null,
        previewsUsedOfBudget: `${previews}/200`,
      };
    });

    // Where people give up, and why — the refusal codes are ours, so this says
    // whether we are losing people to our own caps or to their own doubts.
    const dropReasons = new Map<string, number>();
    for (const r of rows) {
      if (r.event !== 'payment_failed' && r.event !== 'intake_error' && r.event !== 'preview_failed') continue;
      const reason = typeof r.props?.reason === 'string' ? r.props.reason : 'unknown';
      dropReasons.set(`${r.event}:${reason}`, (dropReasons.get(`${r.event}:${reason}`) ?? 0) + 1);
    }

    return Response.json({
      days,
      sampled: rows.length,
      funnel,
      dropReasons: [...dropReasons.entries()]
        .map(([k, count]) => ({ where: k, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 25),
    });
  } catch (err) {
    return jsonError(err);
  }
}
