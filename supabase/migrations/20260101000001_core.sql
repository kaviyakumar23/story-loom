-- Storyloom core schema (§4). Postgres / Supabase.
-- Principles: store the minimum, make children's data deletable, keep an audit
-- trail. Run in the Supabase SQL editor or via psql against the project DB.

create extension if not exists "pgcrypto";
-- ---- profiles: parent account (1:1 with auth.users) ----
create table if not exists profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text,
  country           text,
  marketing_consent boolean not null default false,
  created_at        timestamptz not null default now()
);
-- ---- consent_records: verifiable parental consent, before any child data ----
create table if not exists consent_records (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid not null references profiles (id) on delete cascade,
  method           text not null,
  consent_version  text not null,
  ip_country       text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_consent_parent on consent_records (parent_id);
-- ---- heroes: the child as represented in a book (data-minimized) ----
create table if not exists heroes (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references profiles (id) on delete cascade,
  nickname   text not null,
  age_band   text not null check (age_band in ('3-4','5-6','7-8','9-10')),
  avatar     jsonb not null default '{}'::jsonb,
  interests  text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_heroes_parent on heroes (parent_id);
-- ---- character_sheets: canonical "character bible" (§7). Forward-looking. ----
create table if not exists character_sheets (
  id             uuid primary key default gen_random_uuid(),
  hero_id        uuid not null references heroes (id) on delete cascade,
  version        int not null default 1,
  reference_pack jsonb not null default '{}'::jsonb,
  model_used     text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_sheets_hero on character_sheets (hero_id);
-- ---- books: one generated story ----
create table if not exists books (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid not null references profiles (id) on delete cascade,
  hero_id          uuid not null references heroes (id) on delete restrict,
  consent_id       uuid not null references consent_records (id) on delete restrict,
  goal             text not null,
  language         text not null default 'en',
  reading_level    text not null check (reading_level in ('emerging','early','fluent')),
  status           text not null default 'generating'
                     check (status in ('generating','preview_ready','paid','complete','failed')),
  progress         int not null default 0,
  title            text,
  theme            text,
  cover_asset_id   uuid,
  purchased_tier   text,
  error            jsonb,
  -- Idempotency for POST /books (§5) — one row per (parent, key).
  idempotency_key  text,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_books_parent on books (parent_id);
create unique index if not exists uq_books_idempotency
  on books (parent_id, idempotency_key)
  where idempotency_key is not null;
-- ---- book_pages: story content per page ----
create table if not exists book_pages (
  id                  uuid primary key default gen_random_uuid(),
  book_id             uuid not null references books (id) on delete cascade,
  page_index          int not null,
  text                text not null,
  illustration_prompt text,
  image_asset_id      uuid,
  is_preview          boolean not null default false,
  unique (book_id, page_index)
);
-- ---- assets: every generated file ----
create table if not exists assets (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid references books (id) on delete cascade,
  hero_id     uuid references heroes (id) on delete cascade,
  type        text not null check (type in ('image','pdf','audio','character_sheet')),
  storage_key text not null,            -- R2 key. NEVER a public URL; sign on demand.
  mime        text,
  width       int,
  height      int,
  bytes       bigint,
  created_at  timestamptz not null default now(),
  check (book_id is not null or hero_id is not null)
);
create index if not exists idx_assets_book on assets (book_id);
-- ---- orders ----
create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  parent_id         uuid not null references profiles (id) on delete cascade,
  book_id           uuid not null references books (id) on delete restrict,
  tier              text not null check (tier in ('pdf','pdf_audio_guide','seven_day_pack')),
  amount            bigint not null,    -- smallest currency unit (paise)
  currency          text not null,
  status            text not null default 'created'
                      check (status in ('created','paid','failed','refunded')),
  razorpay_order_id text unique,
  created_at        timestamptz not null default now()
);
create index if not exists idx_orders_parent on orders (parent_id);
create index if not exists idx_orders_book on orders (book_id);
-- ---- payments: idempotent on razorpay_payment_id ----
create table if not exists payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders (id) on delete cascade,
  razorpay_payment_id text not null unique,   -- dedupe key for webhooks
  signature_valid     boolean not null,
  status              text not null,
  raw_webhook         jsonb not null,
  captured_at         timestamptz not null default now()
);
-- ---- generation_events: per-stage telemetry (§12). Forward-looking. ----
create table if not exists generation_events (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books (id) on delete cascade,
  stage       text not null,
  attempt     int not null default 1,
  model       text,
  tokens_in   int,
  tokens_out  int,
  images      int,
  cost_usd    numeric(10,4),
  status      text not null check (status in ('ok','retried','failed')),
  started_at  timestamptz,
  finished_at timestamptz
);
create index if not exists idx_genevents_book on generation_events (book_id);
-- ---- audit_log: DPDP record-keeping ----
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null check (actor in ('parent','system','admin')),
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on audit_log (entity, entity_id);
-- ---- deletion_requests: right to erasure ----
create table if not exists deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  status       text not null default 'pending' check (status in ('pending','completed')),
  completed_at timestamptz
);
-- Keep books.updated_at fresh.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_books_updated_at on books;
create trigger trg_books_updated_at before update on books
  for each row execute function set_updated_at();
