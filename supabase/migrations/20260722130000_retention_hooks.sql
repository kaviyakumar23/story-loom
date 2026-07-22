-- Retention hooks: birthday-month milestone triggers, abandoned-preview win-back
-- tracking, and a newsletter subscriber list. Additive & safe.

-- Birth month enables "turns five next month" nudges (month only — we never
-- store a full DOB; data minimisation, §9).
alter table heroes add column if not exists birth_month int
  check (birth_month is null or (birth_month between 1 and 12));

-- One-shot flag so the win-back cron emails an unpurchased preview at most once.
alter table books add column if not exists winback_sent_at timestamptz;

-- Newsletter signups (footer + "notify me"). Service-role only.
create table if not exists newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text,
  created_at timestamptz not null default now()
);
alter table newsletter_subscribers enable row level security;
-- No parent policy: writes go through the API with the service role.
