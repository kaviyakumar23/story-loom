// Apply ONE supabase migration file to prod and record it in Supabase's own
// history (supabase_migrations.schema_migrations), so `supabase db push` skips
// it. Usage: node scripts/db-apply.mjs <version_name>   (no .sql)
//   e.g. node scripts/db-apply.mjs 20260722130000_retention_hooks
import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

config({ path: '.env.local' });
config();

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/db-apply.mjs <version_name>'); process.exit(1); }
const version = file.split('_')[0];
const name = file.split('_').slice(1).join('_');
const sql = await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), 'utf8');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const already = (await client.query('select 1 from supabase_migrations.schema_migrations where version=$1', [version])).rows.length;
  if (already) { console.log(`already recorded (${version}) — nothing to do`); }
  else {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into supabase_migrations.schema_migrations (version, name, statements) values ($1,$2,$3)', [version, name, [sql]]);
    await client.query('commit');
    console.log(`✓ applied and recorded ${file}`);
  }
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error('FAILED (rolled back):', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
