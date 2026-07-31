// Preflight a print master and say whether a printer can use it.
//
// A thin CLI over src/server/lib/print-preflight.ts — the pipeline runs the same
// checks on every book before release and stores the report, so the file a
// founder inspects by hand and the file the system approves are judged
// identically.
//
// Run: node scripts/print-preflight.mjs <file.pdf> [--json] [--casewrap|--test-form]
import { readFile } from 'node:fs/promises';
import { formatReport, preflight } from '../src/server/lib/print-preflight.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
const mode = args.includes('--casewrap') ? 'casewrap' : args.includes('--test-form') ? 'test-form' : 'interior';

if (!file) {
  console.error('Usage: node scripts/print-preflight.mjs <file.pdf> [--json] [--casewrap|--test-form]');
  process.exit(2);
}

const report = await preflight(await readFile(file), mode);
console.log(asJson ? JSON.stringify({ file, ...report }, null, 2) : formatReport(report, file));
process.exit(report.ok ? 0 : 1);
