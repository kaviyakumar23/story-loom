// Read-only: report migration history + whether the print-fulfilment objects
// exist, so we apply migration 0006 the safe way. No writes.
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local' });
config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const q = async (sql, params = []) => {
  try { return (await client.query(sql, params)).rows; }
  catch (e) { return { error: e.message }; }
};

try {
  await client.connect();
  console.log('connected ✓');

  const hasTable = async (schema, name) =>
    (await q('select 1 from information_schema.tables where table_schema=$1 and table_name=$2', [schema, name])).length > 0;

  console.log('\n-- migration tracking --');
  console.log('runner _migrations table exists:', await hasTable('public', '_migrations'));
  const runnerRows = await q('select name from _migrations order by name');
  console.log('runner-applied:', Array.isArray(runnerRows) ? runnerRows.map(r => r.name) : runnerRows);
  console.log('supabase schema_migrations exists:', await hasTable('supabase_migrations', 'schema_migrations'));
  const supaRows = await q('select version from supabase_migrations.schema_migrations order by version');
  console.log('supabase-applied:', Array.isArray(supaRows) ? supaRows.map(r => r.version) : supaRows);

  console.log('\n-- core tables present? --');
  for (const t of ['profiles', 'books', 'orders', 'payments', 'heroes'])
    console.log(`  ${t}:`, await hasTable('public', t));

  console.log('\n-- print-fulfilment (migration 0006) objects present? --');
  console.log('  shipping_addresses:', await hasTable('public', 'shipping_addresses'));
  console.log('  fulfillments:', await hasTable('public', 'fulfillments'));
  const col = await q("select 1 from information_schema.columns where table_name='books' and column_name='model_tier'");
  console.log('  books.model_tier column:', Array.isArray(col) && col.length > 0);
} catch (e) {
  console.error('CONNECTION FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
