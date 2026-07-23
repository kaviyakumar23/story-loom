// RLS verification against the live DB. Two layers:
//   1. Static audit  — RLS is ENABLED on every table, parent-owned tables have an
//      owner policy referencing auth.uid(), operational tables have NO parent
//      policy (service-role only).
//   2. Behavioural    — as the `authenticated` role with a stranger's JWT sub,
//      every owner-scoped table returns ZERO rows (proves RLS actively filters,
//      i.e. one parent cannot read another's data). Read-only; no fixtures.
//
// Run: node scripts/rls-check.mjs   (needs DATABASE_URL)
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local' });
config();

const STRANGER = '00000000-0000-0000-0000-0000000000ff';

// table -> how it should be protected
const OWNER_SCOPED = ['profiles', 'consent_records', 'heroes', 'character_sheets', 'books', 'book_pages', 'assets', 'orders', 'deletion_requests', 'shipping_addresses', 'fulfillments'];
const SERVICE_ONLY = ['payments', 'generation_events', 'audit_log', 'newsletter_subscribers'];
// owner-scoped tables to hit behaviourally (must return 0 rows for a stranger)
const BEHAVIOURAL = ['books', 'heroes', 'orders', 'shipping_addresses', 'fulfillments', 'book_pages', 'assets', 'character_sheets', 'consent_records'];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
let pass = 0;
let fail = 0;
const ok = (m) => { pass++; console.log(`  ✓ ${m}`); };
const bad = (m) => { fail++; console.log(`  ✗ ${m}`); };

await client.connect();
try {
  // 1a. RLS enabled everywhere
  console.log('\n[1] RLS enabled');
  const relsec = new Map(
    (await client.query(`select relname, relrowsecurity from pg_class where relkind='r' and relnamespace='public'::regnamespace`)).rows.map((r) => [r.relname, r.relrowsecurity]),
  );
  for (const t of [...OWNER_SCOPED, ...SERVICE_ONLY]) {
    relsec.get(t) === true ? ok(`${t}: RLS on`) : bad(`${t}: RLS OFF`);
  }

  // 1b. Policies: owner-scoped reference auth.uid(); service-only have none.
  console.log('\n[2] Policies');
  const pols = (await client.query(`select tablename, policyname, qual from pg_policies where schemaname='public'`)).rows;
  const byTable = new Map();
  for (const p of pols) { if (!byTable.has(p.tablename)) byTable.set(p.tablename, []); byTable.get(p.tablename).push(p); }
  for (const t of OWNER_SCOPED) {
    const ps = byTable.get(t) ?? [];
    ps.length && ps.some((p) => (p.qual ?? '').includes('uid()')) ? ok(`${t}: owner policy references auth.uid()`) : bad(`${t}: missing owner policy`);
  }
  for (const t of SERVICE_ONLY) {
    (byTable.get(t) ?? []).length === 0 ? ok(`${t}: no parent policy (service-role only)`) : bad(`${t}: unexpected parent policy`);
  }

  // 2. Behavioural — a stranger (authenticated role, random sub) sees nothing.
  console.log('\n[3] Behavioural isolation (stranger sees 0 rows)');
  for (const t of BEHAVIOURAL) {
    const total = Number((await client.query(`select count(*)::int c from ${t}`)).rows[0].c);
    await client.query('begin');
    await client.query(`set local role authenticated`);
    await client.query(`set local request.jwt.claims = '{"sub":"${STRANGER}"}'`);
    const seen = Number((await client.query(`select count(*)::int c from ${t}`)).rows[0].c);
    await client.query('rollback');
    if (seen === 0) ok(`${t}: stranger sees 0 of ${total}${total === 0 ? ' (no data yet)' : ''}`);
    else bad(`${t}: stranger saw ${seen} of ${total} — RLS NOT filtering!`);
  }

  console.log(`\n${fail === 0 ? '✓ ALL RLS CHECKS PASSED' : '✗ RLS CHECKS FAILED'} — ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
} catch (e) {
  console.error('RLS check errored:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
