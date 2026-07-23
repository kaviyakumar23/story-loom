import { loadEnv } from '../config/env';
import { dueOccasions } from '../config/occasions';
import { audit } from '../lib/audit';
import { sendOccasionNudge } from '../lib/email';
import { canSendMarketing, unsubscribeUrl } from '../lib/marketing';
import { serviceClient } from '../lib/supabase';
import { inngest } from './client';

/**
 * Occasion & birthday reminders (retention). Once a day, for each occasion whose
 * lead window is open — and for heroes whose birthday month is next — email past
 * buyers a prefilled reorder link. Consent-gated (canSendMarketing), deduped by
 * a claim-before-send row, and capped per run so a festival blast never outruns
 * the solo founder's print queue.
 *
 * Targets are BUYERS only (parents with ≥1 purchased book) — the win-back cron
 * owns unpurchased previews.
 */
const SENDS_PER_RUN = 100;

interface Target {
  parentId: string;
  heroId: string;
  nickname: string;
  lastBookId: string;
}

export const occasionNudges = inngest.createFunction(
  { id: 'occasion-nudges', name: 'Occasion & birthday reminders', triggers: [{ cron: '8 13 * * *' }] },
  async ({ step }) => {
    const env = loadEnv();

    const plan = await step.run('plan', async () => {
      const today = new Date();
      // Birthdays are nudged a month ahead (month-only granularity).
      const m = today.getUTCMonth(); // 0-11
      const nextMonth = ((m + 1) % 12) + 1; // 1-12
      const bdayYear = m === 11 ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
      return { due: dueOccasions(today), nextMonth, bdayYear };
    });

    let sent = 0;

    for (const occ of plan.due) {
      const targets = await step.run(`targets-${occ.key}`, async () => buyerTargets());
      for (const t of targets) {
        if (sent >= SENDS_PER_RUN) break;
        const did = await step.run(`nudge-${occ.key}-${t.heroId}`, async () =>
          nudge(t, occ.key, occ.label, occ.pack ?? null, false, env.APP_BASE_URL),
        );
        if (did) sent += 1;
      }
    }

    // Birthdays: heroes whose birth_month is next month.
    const bdayKey = `birthday-${plan.bdayYear}-${String(plan.nextMonth).padStart(2, '0')}`;
    const bdayTargets = await step.run('bday-targets', async () => buyerTargets(plan.nextMonth));
    for (const t of bdayTargets) {
      if (sent >= SENDS_PER_RUN) break;
      const did = await step.run(`nudge-${bdayKey}-${t.heroId}`, async () =>
        nudge(t, bdayKey, 'birthday', null, true, env.APP_BASE_URL),
      );
      if (did) sent += 1;
    }

    // Sibling intro: parents with exactly one hero, ~2 weeks after delivery.
    const sibTargets = await step.run('sibling-targets', async () => siblingTargets());
    for (const t of sibTargets) {
      if (sent >= SENDS_PER_RUN) break;
      const did = await step.run(`nudge-sibling-${t.heroId}`, async () =>
        nudge(t, 'sibling-intro', 'sibling', null, false, env.APP_BASE_URL, true),
      );
      if (did) sent += 1;
    }

    return { occasions: plan.due.map((o) => o.key), sent };
  },
);

/**
 * One target per hero that has at least one purchased book (latest book kept for
 * the reorder deep link). Optionally filtered to a birthday month.
 */
async function buyerTargets(birthMonth?: number): Promise<Target[]> {
  const db = serviceClient();
  const { data: books } = await db
    .from('books')
    .select('id, parent_id, hero_id, paid_at')
    .not('purchased_tier', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(2000);
  const rows = (books ?? []) as { id: string; parent_id: string; hero_id: string; paid_at: string | null }[];
  const heroIds = [...new Set(rows.map((r) => r.hero_id))];
  if (!heroIds.length) return [];

  const { data: heroes } = await db.from('heroes').select('id, nickname, birth_month').in('id', heroIds);
  const heroMap = new Map(
    ((heroes ?? []) as { id: string; nickname: string; birth_month: number | null }[]).map((h) => [h.id, h]),
  );

  const byHero = new Map<string, Target>();
  for (const r of rows) {
    if (byHero.has(r.hero_id)) continue; // rows are newest-first → first is latest
    const hero = heroMap.get(r.hero_id);
    if (!hero) continue;
    if (birthMonth && hero.birth_month !== birthMonth) continue;
    byHero.set(r.hero_id, { parentId: r.parent_id, heroId: r.hero_id, nickname: hero.nickname ?? 'your child', lastBookId: r.id });
  }
  return [...byHero.values()];
}

/** Claim-then-send one reminder. Returns true only if an email actually went out. */
async function nudge(
  t: Target,
  key: string,
  label: string,
  pack: string | null,
  isBirthday: boolean,
  baseUrl: string,
  isSibling = false,
): Promise<boolean> {
  const db = serviceClient();
  // Consent + email first — a parent who hasn't opted in (or has no email) stays
  // eligible for a later day in the window rather than burning the nudge.
  if (!(await canSendMarketing(t.parentId))) return false;
  const { data: u } = await db.auth.admin.getUserById(t.parentId);
  const email = u.user?.email;
  if (!email) return false;

  // Claim the dedupe row BEFORE sending; a duplicate means it's already gone out.
  const { error } = await db.from('occasion_nudges').insert({ parent_id: t.parentId, hero_id: t.heroId, occasion_key: key });
  if (error) return false;

  // A sibling nudge starts a NEW hero (no ?from prefill); everything else reorders
  // the same child.
  const link = isSibling
    ? `${baseUrl}/create`
    : `${baseUrl}/create?from=${t.lastBookId}${pack ? `&pack=${pack}` : ''}`;
  try {
    await sendOccasionNudge(email, { heroName: t.nickname, occasion: label, isBirthday, isSibling, url: link, unsubscribeUrl: unsubscribeUrl(t.parentId) });
    await audit({ actor: 'system', action: 'occasion.nudged', entity: 'profiles', entityId: t.parentId, metadata: { key, heroId: t.heroId } });
    return true;
  } catch {
    // Best-effort; the claim row already prevents a duplicate on the next run.
    return false;
  }
}

/**
 * Parents with exactly one hero whose book was delivered ~2 weeks ago — a good
 * moment to suggest a story for a sibling. Deduped once-ever via 'sibling-intro'.
 */
async function siblingTargets(): Promise<Target[]> {
  const db = serviceClient();
  const now = Date.now();
  const from = new Date(now - 16 * 86_400_000).toISOString();
  const to = new Date(now - 14 * 86_400_000).toISOString();
  const { data: books } = await db
    .from('books')
    .select('id, parent_id, hero_id, completed_at')
    .eq('status', 'complete')
    .gte('completed_at', from)
    .lt('completed_at', to)
    .limit(500);
  const rows = (books ?? []) as { id: string; parent_id: string; hero_id: string; completed_at: string | null }[];
  if (!rows.length) return [];

  const parentIds = [...new Set(rows.map((r) => r.parent_id))];
  const { data: heroesData } = await db.from('heroes').select('id, parent_id, nickname').in('parent_id', parentIds);
  const heroes = (heroesData ?? []) as { id: string; parent_id: string; nickname: string }[];
  const heroCount = new Map<string, number>();
  for (const h of heroes) heroCount.set(h.parent_id, (heroCount.get(h.parent_id) ?? 0) + 1);
  const nickById = new Map(heroes.map((h) => [h.id, h.nickname]));

  const byParent = new Map<string, Target>();
  for (const r of rows) {
    if (heroCount.get(r.parent_id) !== 1) continue; // only single-hero parents
    if (byParent.has(r.parent_id)) continue;
    byParent.set(r.parent_id, { parentId: r.parent_id, heroId: r.hero_id, nickname: nickById.get(r.hero_id) ?? 'your child', lastBookId: r.id });
  }
  return [...byParent.values()];
}
