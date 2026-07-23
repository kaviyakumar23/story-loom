-- Occasion & birthday reminder dedupe. One row per (parent, hero, occasion) is
-- claimed BEFORE the email sends, so a retry can't double-send and an email-less
-- run never consumes the nudge. Service-role only (writes go through the cron).
create table if not exists occasion_nudges (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references profiles (id) on delete cascade,
  hero_id      uuid,
  occasion_key text not null,
  sent_at      timestamptz not null default now(),
  unique (parent_id, hero_id, occasion_key)
);
alter table occasion_nudges enable row level security;
-- No parent policy: the reminder cron uses the service role.
