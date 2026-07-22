// One-off: apply ONLY migration 0006 to prod and record it in Supabase's own
// migration history (supabase_migrations.schema_migrations), so a later
// `supabase db push` treats it as applied. The runner (npm run migrate) can't
// be used here because prod was set up via the Supabase CLI, not the runner.
import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

config({ path: '.env.local' });
config();

const VERSION = '20260722120000';
const NAME = 'print_fulfillment';
const sql = await readFile(new URL('../supabase/migrations/20260722120000_print_fulfillment.sql', import.meta.url), 'utf8');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const already = (await client.query('select 1 from supabase_migrations.schema_migrations where version=$1', [VERSION])).rows.length;
  if (already) { console.log(`already recorded (${VERSION}) — nothing to do`); }
  else {
    await client.query('begin');
    await client.query(sql);
    await client.query(
      'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1,$2,$3)',
      [VERSION, NAME, [sql]],
    );
    await client.query('commit');
    console.log(`✓ applied and recorded ${VERSION}_${NAME}`);
  }
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error('FAILED (rolled back):', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
