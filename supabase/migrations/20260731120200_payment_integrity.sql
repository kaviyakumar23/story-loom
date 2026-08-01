-- Payment integrity: one payable order per book, and a journal of every webhook.
--
-- Nothing here is new functionality — it is the difference between a payment
-- flow that works when everything goes right and one that survives a customer
-- double-clicking, a network retry, or Razorpay delivering the same event twice.

-- ---------------------------------------------------------------------------
-- One payable order per book.
--
-- Two clicks on "pay" created two Razorpay orders, both payable, and the
-- customer could be charged twice with nothing to stop it: there was no unique
-- constraint anywhere, and the route never looked for an existing order. The
-- partial index allows any number of failed or refunded attempts (a parent
-- retrying after a declined card is normal) while permitting only one order
-- that is currently open or already paid.
create unique index if not exists uq_orders_open_per_book
  on orders (book_id)
  where status in ('created', 'paid') and book_id is not null;

-- When money actually moved. Until now the only timestamp on a paid order was
-- books.paid_at, which is deleted along with the book on erasure — leaving a
-- financial record with no payment date.
alter table orders add column if not exists paid_at timestamptz;

-- Stamped at checkout so the price experiment can be read off the order itself
-- rather than reconstructed from timestamps.
alter table orders add column if not exists price_arm text;
alter table orders add column if not exists metro text;

-- One ship-to per order. A retried checkout used to append a second address row
-- with no way to tell which one was current.
create unique index if not exists uq_shipping_address_order
  on shipping_addresses (order_id)
  where order_id is not null;

-- ---------------------------------------------------------------------------
-- Webhook journal.
--
-- Deduplication used to rest entirely on payments.razorpay_payment_id, which
-- only catches repeats of the same payment. Razorpay's own event id was never
-- read, so a redelivered event of any other type was reprocessed, and an event
-- that arrived out of order (a refund before its capture) was dropped on the
-- floor with nothing recording that it had happened.
--
-- Every event now lands here first. The unique event id makes redelivery a
-- no-op; 'deferred' holds an event that arrived before the thing it refers to,
-- for the reconcile cron to replay; 'unmatched' is real money we cannot tie to
-- an order, which a human must see.
create table if not exists webhook_events (
  id                  uuid primary key default gen_random_uuid(),
  razorpay_event_id   text unique,
  event_type          text not null,
  razorpay_payment_id text,
  razorpay_order_id   text,
  status              text not null default 'processed'
    check (status in ('processed', 'duplicate', 'unmatched', 'deferred', 'dead_letter')),
  raw                 jsonb not null,
  error               text,
  attempts            int not null default 1,
  created_at          timestamptz not null default now(),
  processed_at        timestamptz
);
-- Service-role only: no parent policy. These rows are the payment audit trail.
alter table webhook_events enable row level security;

-- The replay sweep reads deferred events oldest-first.
create index if not exists idx_webhook_events_deferred
  on webhook_events (created_at)
  where status = 'deferred';

-- Which event produced a payment row, so a payment can be traced to its
-- delivery rather than only to its Razorpay id.
alter table payments add column if not exists razorpay_event_id text;
