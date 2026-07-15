-- Make real account deletion possible (§9 right to erasure).
--
-- Deleting a parent's auth.users row cascades profiles → heroes/books/consent.
-- Verified against Postgres 16: that cascade resolves cleanly, INCLUDING the
-- books.consent_id RESTRICT. What it also did was delete the parent's orders and
-- payments — the financial records tax retention requires us to keep. So orders
-- detach instead of cascading: the row survives with amount/tier/date/razorpay
-- ids (no personal data), and payments ride along via orders.
alter table orders alter column parent_id drop not null;
alter table orders alter column book_id   drop not null;

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'orders'::regclass and confrelid = 'profiles'::regclass and contype = 'f';
  if c is not null then execute format('alter table orders drop constraint %I', c); end if;
  alter table orders add constraint orders_parent_id_fkey
    foreign key (parent_id) references profiles (id) on delete set null;

  select conname into c from pg_constraint
   where conrelid = 'orders'::regclass and confrelid = 'books'::regclass and contype = 'f';
  if c is not null then execute format('alter table orders drop constraint %I', c); end if;
  alter table orders add constraint orders_book_id_fkey
    foreign key (book_id) references books (id) on delete set null;
end $$;

-- Consent withdrawal must be as easy as granting it (DPDP §6(4)-(6)), which
-- means it has to be representable at all.
alter table consent_records add column if not exists withdrawn_at timestamptz;

-- One feedback row per book, updated in place — the route upserts on this.
delete from book_feedback a using book_feedback b
  where a.book_id = b.book_id and a.ctid < b.ctid;
create unique index if not exists uq_book_feedback_book on book_feedback (book_id);

-- Indexes for the cron scans (reconcile: paid+stuck, retention: unpurchased+old)
-- and for erasure's hero-scoped asset lookup.
create index if not exists idx_books_status_updated on books (status, updated_at);
create index if not exists idx_books_unpurchased on books (created_at) where purchased_tier is null;
create index if not exists idx_assets_hero on assets (hero_id);
