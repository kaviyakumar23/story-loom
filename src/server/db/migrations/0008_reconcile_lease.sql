-- Reconciler lease: don't re-enqueue the same paid-but-stuck book on every 15-min
-- cron. Lease it so a genuinely slow/failing fulfilment is retried at most once
-- per lease window (per-book concurrency:1 remains the real double-run guard).
alter table books add column if not exists reconcile_leased_at timestamptz;
