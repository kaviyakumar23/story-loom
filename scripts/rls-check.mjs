// RLS verification against the live DB. Three layers:
//   1. Coverage      — every public table is CLASSIFIED below; an unknown table
//      fails the run, so a new migration can never silently escape this audit.
//   2. Static audit  — RLS is ENABLED on every table; owner tables have a policy
//      referencing auth.uid(); read-only tables have EXACTLY one SELECT policy;
//      operational tables have NO parent policy (service-role only).
//   3. Behavioural   — as the `authenticated` role with a stranger's JWT sub,
//      every owner-scoped table returns ZERO rows (proves RLS actively filters).
//      Read-only; no fixtures. NOTE: with an empty table this proves nothing —
//      the run warns when every behavioural table is empty.
//
// Run: node scripts/rls-check.mjs   (needs DATABASE_URL)
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local' });
config();

const STRANGER = '00000000-0000-0000-0000-0000000000ff';

// table -> how it should be protected. EVERY public table must appear in
// exactly one list (coverage check below enforces this).
const OWNER_SCOPED = [
  'profiles', 'consent_records', 'heroes', 'character_sheets', 'books', 'book_pages',
  'assets', 'orders', 'deletion_requests', 'shipping_addresses', 'fulfillments',
  'book_events', 'book_feedback', 'book_reading_guides', 'book_revision_requests', 'book_share_links',
];
// Parents may READ their own rows (exactly one SELECT policy); writes are service-role only.
const OWNER_READ_ONLY = ['photo_uploads'];
const SERVICE_ONLY = ['payments', 'generation_events', 'audit_log', 'newsletter_subscribers', 'occasion_nudges', 'preview_ip_usage'];
// owner-scoped tables to hit behaviourally (must return 0 rows for a stranger)
const BEHAVIOURAL = [
  'books', 'heroes', 'orders', 'shipping_addresses', 'fulfillments', 'book_pages', 'assets',
  'character_sheets', 'consent_records', 'book_events', 'book_feedback', 'book_reading_guides',
  'book_revision_requests', 'book_share_links', 'photo_uploads',
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
let pass = 0;
let fail = 0;
const ok = (m) => { pass++; console.log(`  ✓ ${m}`); };
const bad = (m) => { fail++; console.log(`  ✗ ${m}`); };

await client.connect();
try {
  const ALL_CLASSIFIED = [...OWNER_SCOPED, ...OWNER_READ_ONLY, ...SERVICE_ONLY];

  // 0. Coverage — no public table may be unclassified (or misspelled here).
  console.log('\n[0] Coverage (every public table is classified)');
  const live = (await client.query(
    `select relname from pg_class where relkind='r' and relnamespace='public'::regnamespace`,
  )).rows.map((r) => r.relname);
  const unclassified = live.filter((t) => !ALL_CLASSIFIED.includes(t));
  const phantom = ALL_CLASSIFIED.filter((t) => !live.includes(t));
  unclassified.length === 0
    ? ok(`all ${live.length} public tables are classified`)
    : bad(`UNCLASSIFIED tables (add them to a list in this script): ${unclassified.join(', ')}`);
  for (const t of phantom) bad(`classified table does not exist in DB: ${t}`);

  // 1a. RLS enabled everywhere
  console.log('\n[1] RLS enabled');
  const relsec = new Map(
    (await client.query(`select relname, relrowsecurity from pg_class where relkind='r' and relnamespace='public'::regnamespace`)).rows.map((r) => [r.relname, r.relrowsecurity]),
  );
  for (const t of ALL_CLASSIFIED) {
    relsec.get(t) === true ? ok(`${t}: RLS on`) : bad(`${t}: RLS OFF`);
  }

  // 1b. Policies: owner tables reference auth.uid(); read-only tables have
  // exactly one SELECT policy; service-only tables have none.
  console.log('\n[2] Policies');
  const pols = (await client.query(`select tablename, policyname, cmd, qual from pg_policies where schemaname='public'`)).rows;
  const byTable = new Map();
  for (const p of pols) { if (!byTable.has(p.tablename)) byTable.set(p.tablename, []); byTable.get(p.tablename).push(p); }
  for (const t of OWNER_SCOPED) {
    const ps = byTable.get(t) ?? [];
    ps.length && ps.some((p) => (p.qual ?? '').includes('uid()')) ? ok(`${t}: owner policy references auth.uid()`) : bad(`${t}: missing owner policy`);
  }
  for (const t of OWNER_READ_ONLY) {
    const ps = byTable.get(t) ?? [];
    const onlySelect = ps.length === 1 && ps[0].cmd === 'SELECT' && (ps[0].qual ?? '').includes('uid()');
    onlySelect
      ? ok(`${t}: exactly one owner SELECT policy (writes are service-role only)`)
      : bad(`${t}: expected exactly one SELECT policy referencing auth.uid(), found ${ps.map((p) => `${p.policyname}(${p.cmd})`).join(', ') || 'none'}`);
  }
  for (const t of SERVICE_ONLY) {
    (byTable.get(t) ?? []).length === 0 ? ok(`${t}: no parent policy (service-role only)`) : bad(`${t}: unexpected parent policy`);
  }

  // 2. Behavioural — a stranger (authenticated role, random sub) sees nothing.
  console.log('\n[3] Behavioural isolation (stranger sees 0 rows)');
  let rowsSeenTotal = 0;
  for (const t of BEHAVIOURAL) {
    const total = Number((await client.query(`select count(*)::int c from ${t}`)).rows[0].c);
    rowsSeenTotal += total;
    await client.query('begin');
    await client.query(`set local role authenticated`);
    await client.query(`set local request.jwt.claims = '{"sub":"${STRANGER}"}'`);
    const seen = Number((await client.query(`select count(*)::int c from ${t}`)).rows[0].c);
    await client.query('rollback');
    if (seen === 0) ok(`${t}: stranger sees 0 of ${total}${total === 0 ? ' (no data yet)' : ''}`);
    else bad(`${t}: stranger saw ${seen} of ${total} — RLS NOT filtering!`);
  }
  if (rowsSeenTotal === 0) {
    console.log('  ⚠ every behavioural table is EMPTY — isolation is unproven until real rows');
    console.log('    exist; re-run this check once the first beta data lands.');
  }

  console.log(`\n${fail === 0 ? '✓ ALL RLS CHECKS PASSED' : '✗ RLS CHECKS FAILED'} — ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
} catch (e) {
  console.error('RLS check errored:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
