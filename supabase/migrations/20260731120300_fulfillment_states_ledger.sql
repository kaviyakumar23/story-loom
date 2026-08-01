-- Fulfilment states, an immutable release record, exceptions, and the ledger.
--
-- Two shapes, deliberately. The linear part of a printed order — waiting for QC,
-- held, released, printing, shipped, delivered — stays a status column, because
-- it is genuinely a sequence and a transition map can police it. Everything else
-- that happens to an order is NOT a sequence: a book can be shipped, come back
-- as an RTO, be reshipped, and then be delivered. Modelling those as statuses
-- would mean either losing history or rewriting the machine, so they are
-- append-only events instead.

-- ---------------------------------------------------------------------------
-- QC before the printer.
--
-- A paid book used to land in the print queue at 'print_ready' with no human
-- step in between: generation finished and the file was, as far as the system
-- was concerned, ready to print. For a run that ends in a physical object sent
-- to a child, the review has to be a state someone must clear.
alter table fulfillments drop constraint if exists fulfillments_status_check;
alter table fulfillments add constraint fulfillments_status_check
  check (status in ('qc_pending', 'qc_hold', 'print_ready', 'printing', 'shipped', 'delivered', 'cancelled'));
alter table fulfillments alter column status set default 'qc_pending';

-- The open exception, if any, so the queue can show "shipped, but RTO" without
-- losing either fact.
alter table fulfillments add column if not exists open_exception text
  check (open_exception is null or open_exception in ('reprint', 'reship', 'rto', 'lost'));

alter table fulfillments add column if not exists qc_notes text;
alter table fulfillments add column if not exists qc_passed_at timestamptz;

-- ---------------------------------------------------------------------------
-- What was sent to the printer, and by whom.
--
-- "We printed the wrong version" is unanswerable without a record of which bytes
-- were released. The row is immutable by construction: no update or delete is
-- granted, so a release cannot be quietly rewritten after a complaint.
create table if not exists print_releases (
  id             uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null references fulfillments (id) on delete restrict,
  order_id       uuid not null references orders (id) on delete restrict,
  book_id        uuid not null,
  pdf_storage_key text not null,
  pdf_sha256     text not null,
  released_by    text not null,
  released_at    timestamptz not null default now()
);
alter table print_releases enable row level security;
revoke update, delete on print_releases from public, anon, authenticated;
create index if not exists idx_print_releases_order on print_releases (order_id);

-- ---------------------------------------------------------------------------
-- Everything that is not a straight line.
create table if not exists order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders (id) on delete restrict,
  book_id    uuid,
  type       text not null check (type in (
    'qc_pass', 'qc_hold', 'released', 'reprint', 'reship', 'rto', 'lost',
    'refund', 'feedback', 'quality_score', 'cost', 'note'
  )),
  payload    jsonb not null default '{}'::jsonb,
  actor      text not null,
  created_at timestamptz not null default now()
);
alter table order_events enable row level security;
create index if not exists idx_order_events_order on order_events (order_id, created_at);

-- Founder-entered unit economics. The AI cost is already tracked per book; what
-- was never captured is everything that decides whether a printed order actually
-- made money — printing, packing, postage, the payment fee, and the founder's
-- own time, which is the cost most easily pretended to be zero.
create table if not exists order_costs (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete restrict,
  kind        text not null check (kind in ('print', 'pack', 'ship', 'payment_fee', 'labour_minutes', 'other')),
  amount_paise int,
  minutes     int,
  note        text,
  created_at  timestamptz not null default now()
);
alter table order_costs enable row level security;
create index if not exists idx_order_costs_order on order_costs (order_id);

-- ---------------------------------------------------------------------------
-- Keep the cost ledger when a book goes.
--
-- generation_events cascaded with books, so a retention purge or an erasure took
-- the record of what that book cost to make with it — leaving no way to
-- reconstruct historical margin. The book id becomes null; the row survives.
alter table generation_events drop constraint if exists generation_events_book_id_fkey;
alter table generation_events
  add constraint generation_events_book_id_fkey
  foreign key (book_id) references books (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Erasure that cannot cancel a paid order by accident.
--
-- Deleting an account mid-fulfilment cascaded away the fulfilment row and the
-- shipping address and deleted the print master, silently cancelling a paid
-- physical order with no operator visibility at all. Erasure is now deferred
-- until the order reaches a terminal state.
alter table deletion_requests drop constraint if exists deletion_requests_status_check;
alter table deletion_requests add constraint deletion_requests_status_check
  check (status in ('pending', 'deferred', 'completed'));
alter table deletion_requests add column if not exists deferred_reason text;
alter table deletion_requests add column if not exists deferred_until timestamptz;

-- ---------------------------------------------------------------------------
-- Release: one transaction, or not at all.
--
-- The check and the state change have to be atomic. Split across two statements,
-- a refund landing in between would let a refunded book go to print.
create or replace function release_to_print(
  p_fulfillment uuid,
  p_sha text,
  p_reviewer text
) returns table (released boolean, reason text)
language plpgsql
as $$
declare
  v_order   uuid;
  v_book    uuid;
  v_key     text;
  v_status  text;
  v_paid    text;
begin
  select f.order_id, f.book_id, f.print_master_key, f.status
    into v_order, v_book, v_key, v_status
    from fulfillments f
   where f.id = p_fulfillment
     for update;

  if v_order is null then
    return query select false, 'not_found'; return;
  end if;
  if v_status <> 'print_ready' then
    return query select false, 'not_ready'; return;
  end if;

  select o.status into v_paid from orders o where o.id = v_order for update;
  if v_paid is distinct from 'paid' then
    return query select false, 'order_not_paid'; return;
  end if;

  insert into print_releases (fulfillment_id, order_id, book_id, pdf_storage_key, pdf_sha256, released_by)
  values (p_fulfillment, v_order, v_book, v_key, p_sha, p_reviewer);

  update fulfillments set status = 'printing', printed_at = now() where id = p_fulfillment;
  insert into order_events (order_id, book_id, type, payload, actor)
  values (v_order, v_book, 'released', jsonb_build_object('sha256', p_sha), p_reviewer);

  return query select true, null::text;
end;
$$;
revoke execute on function release_to_print(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Refund: stop the book, in the same transaction as the status change.
create or replace function apply_refund(p_order uuid)
returns table (already_released boolean, fulfillment_cancelled boolean)
language plpgsql
as $$
declare
  v_book     uuid;
  v_status   text;
  v_released boolean := false;
  v_cancelled boolean := false;
begin
  select o.book_id into v_book from orders o where o.id = p_order for update;
  update orders set status = 'refunded' where id = p_order;

  select f.status into v_status from fulfillments f where f.order_id = p_order for update;
  if v_status is not null then
    if v_status in ('qc_pending', 'qc_hold', 'print_ready') then
      update fulfillments set status = 'cancelled', cancelled_at = now() where order_id = p_order;
      v_cancelled := true;
    else
      -- Already printing or beyond: software cannot recall a file from a press.
      v_released := true;
    end if;
  end if;

  -- Take the book out of 'paid' as well, or the reconcile cron will keep
  -- re-enqueueing a refunded order for generation.
  if v_book is not null then
    update books set status = 'failed',
                     error = jsonb_build_object('code', 'refunded', 'message', 'This order was refunded.')
     where id = v_book and status in ('paid', 'complete');
  end if;

  insert into order_events (order_id, book_id, type, payload, actor)
  values (p_order, v_book, 'refund', jsonb_build_object('alreadyReleased', v_released), 'system');

  return query select v_released, v_cancelled;
end;
$$;
revoke execute on function apply_refund(uuid) from public, anon, authenticated;
