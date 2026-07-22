-- Print fulfilment foundation.
-- Decision (2026-07-22): the printed book is the main product; fulfilment is
-- manual/founder-run (parent pays -> founder prints -> founder ships). This
-- migration is ADDITIVE and safe: new tables, new nullable columns, a widened
-- order-tier check. No existing rows change; existing code paths are unaffected
-- until the print flow is wired.

-- ---- shipping_addresses: where a physical order ships (parent-provided PII) ----
create table if not exists shipping_addresses (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid not null references profiles (id) on delete cascade,
  order_id       uuid references orders (id) on delete set null,
  recipient_name text not null,
  phone          text not null,
  line1          text not null,
  line2          text,
  city           text not null,
  state          text not null,
  postal_code    text not null,
  country        text not null default 'IN',
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_shipaddr_parent on shipping_addresses (parent_id);
create index if not exists idx_shipaddr_order  on shipping_addresses (order_id);

-- ---- fulfillments: physical print+ship lifecycle, advanced MANUALLY by the
-- founder from the admin queue. One row per (book, kind). Unique constraint is
-- the idempotency key: a ret/re-run never creates a second fulfilment. ----
create table if not exists fulfillments (
  id               uuid primary key default gen_random_uuid(),
  book_id          uuid not null references books (id) on delete cascade,
  order_id         uuid not null references orders (id) on delete restrict,
  address_id       uuid references shipping_addresses (id) on delete set null,
  kind             text not null default 'print' check (kind in ('print','digital')),
  status           text not null default 'print_ready'
                     check (status in ('print_ready','printing','shipped','delivered','cancelled')),
  carrier          text,
  tracking_number  text,
  print_master_key text,                 -- storage key of the print-ready PDF (immutable once set)
  printed_at       timestamptz,
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_fulfillment_book_kind on fulfillments (book_id, kind);
create index if not exists idx_fulfillment_status on fulfillments (status);

drop trigger if exists trg_fulfillments_updated_at on fulfillments;
create trigger trg_fulfillments_updated_at before update on fulfillments
  for each row execute function set_updated_at();

-- ---- books: stamp the generation config at creation, so the preview pages and
-- the paid render stay stylistically identical even if MODEL_TIER or a provider
-- default changes between the two (prevents a book split across model versions).
alter table books add column if not exists model_tier     text;
alter table books add column if not exists text_model      text;
alter table books add column if not exists image_model     text;
alter table books add column if not exists prompt_version  text;
alter table books add column if not exists edition         int not null default 1;

-- ---- orders: allow physical tiers. Prices are set later in config/pricing.ts;
-- these tiers stay disabled until a price is decided. ----
alter table orders drop constraint if exists orders_tier_check;
alter table orders add constraint orders_tier_check
  check (tier in ('pdf','pdf_audio_guide','seven_day_pack','print','print_digital'));

-- ---- RLS for the new tables (defense-in-depth; service role bypasses) ----
alter table shipping_addresses enable row level security;
alter table fulfillments       enable row level security;

-- Parent owns their shipping addresses.
create policy shipaddr_owner on shipping_addresses
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- Fulfilment is founder/admin-operated: parents may READ their own (via book
-- ownership) to see status/tracking, but only the service role writes.
create policy fulfillment_read on fulfillments
  for select using (
    exists (select 1 from books b where b.id = fulfillments.book_id and b.parent_id = auth.uid())
  );
