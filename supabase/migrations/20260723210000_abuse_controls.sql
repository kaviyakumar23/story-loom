-- Free-generation abuse controls (layered; active once the invite gate opens).
--
-- Per-IP daily preview counter, DB-backed so it holds across serverless
-- instances. The IP is stored ONLY as a salted SHA-256 hash (DPDP data
-- minimisation — we can rate-limit an address without keeping it), and rows are
-- purged after 30 days by the retention cron. Service-role only.
create table if not exists preview_ip_usage (
  ip_hash text not null,
  day     date not null,
  count   int  not null default 0,
  primary key (ip_hash, day)
);
alter table preview_ip_usage enable row level security;
-- No parent policy: writes/reads go through the API with the service role.

-- Atomic increment-and-return (an app-side read-modify-write would race across
-- serverless instances). Service-role only: not callable by anon/authenticated.
create or replace function bump_preview_ip(p_ip_hash text, p_day date)
returns int
language sql
as $$
  insert into preview_ip_usage (ip_hash, day, count) values (p_ip_hash, p_day, 1)
  on conflict (ip_hash, day) do update set count = preview_ip_usage.count + 1
  returning count;
$$;
revoke execute on function bump_preview_ip(text, date) from public, anon, authenticated;
