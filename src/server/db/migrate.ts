import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/**
 * Minimal forward-only migration runner. Applies every *.sql in ./migrations in
 * filename order that hasn't been recorded yet, each in its own transaction, and
 * tracks applied files in a `_migrations` table.
 *
 * Usage: `DATABASE_URL=postgres://... npm run migrate`
 * (the Supabase project's direct connection string). Standalone — it reads
 * DATABASE_URL directly and does not load the app's full env schema.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to run migrations');

  const dir = fileURLToPath(new URL('./migrations', import.meta.url));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      'create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const { rows } = await client.query<{ name: string }>('select name from _migrations');
    const applied = new Set(rows.map((r) => r.name));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`· skip ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(`${dir}/${file}`, 'utf8');
      console.log(`▸ applying ${file} …`);
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into _migrations (name) values ($1)', [file]);
        await client.query('commit');
        count += 1;
      } catch (err) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(count ? `✓ applied ${count} migration(s)` : '✓ database already up to date');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
