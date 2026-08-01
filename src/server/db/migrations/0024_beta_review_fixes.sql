-- Fixes for defects found reviewing the beta branch.

-- ---------------------------------------------------------------------------
-- 1. The shipping-address upsert could never have worked.
--
-- `uq_shipping_address_order` was created PARTIAL (`where order_id is not null`).
-- Postgres will not infer a partial unique index as an ON CONFLICT arbiter
-- unless the statement repeats the predicate, and PostgREST emits a bare
-- `ON CONFLICT (order_id)`. That fails at PLAN time with 42P10 — on every call,
-- not only on an actual conflict — so every checkout for the one sellable tier
-- would have 500'd after already consuming its one-open-order slot, leaving the
-- book permanently unbuyable.
--
-- The predicate was redundant anyway: NULLs are distinct under a plain unique
-- index, so many rows may still have a null order_id.
drop index if exists uq_shipping_address_order;
create unique index if not exists uq_shipping_address_order
  on shipping_addresses (order_id);

-- ---------------------------------------------------------------------------
-- 2. Abandoned checkouts were consuming beta capacity indefinitely.
--
-- The total and per-metro caps only counted a 'created' order for 45 minutes,
-- but the day and week caps counted it forever. Three people opening the
-- Razorpay window and closing it would therefore block every other customer for
-- 24 hours, and fifteen would block a week — while nobody had paid anything.
-- The hold window now applies to all four counts, consistently.
--
-- Also: the slot check is advisory. It runs in its own transaction, so its lock
-- is gone by the time the caller inserts the order. That is acceptable because
-- the insert is the real reservation and the caps are soft business limits, not
-- correctness invariants — but it means a burst can overshoot by a few, and it
-- should not be mistaken for a hard guarantee.
create or replace function claim_beta_order_slot(p_metro text)
returns text
language plpgsql
as $$
declare
  v_total int;
  v_metro int;
  v_day   int;
  v_week  int;
  v_qc    int;
  -- An abandoned checkout must not hold a slot for ever.
  v_hold  interval := interval '45 minutes';
begin
  perform pg_advisory_xact_lock(hashtext('beta_order_slot'));

  -- A backlog the founder cannot clear is the real capacity limit.
  select count(*) into v_qc from fulfillments where status in ('qc_pending', 'qc_hold');
  if v_qc > 5 then return 'qc_backlog'; end if;

  select count(*) into v_total from orders
   where status = 'paid' or (status = 'created' and created_at > now() - v_hold);
  if v_total >= 75 then return 'cap_total'; end if;

  select count(*) into v_metro from orders
   where metro = p_metro
     and (status = 'paid' or (status = 'created' and created_at > now() - v_hold));
  if v_metro >= 25 then return 'cap_metro'; end if;

  select count(*) into v_day from orders
   where created_at > now() - interval '1 day'
     and (status = 'paid' or (status = 'created' and created_at > now() - v_hold));
  if v_day >= 3 then return 'cap_day'; end if;

  select count(*) into v_week from orders
   where created_at > now() - interval '7 days'
     and (status = 'paid' or (status = 'created' and created_at > now() - v_hold));
  if v_week >= 15 then return 'cap_week'; end if;

  return 'ok';
end;
$$;
revoke execute on function claim_beta_order_slot(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. A webhook journal row now records that we RECEIVED an event, not that we
--    finished handling it.
--
-- It was inserted pre-stamped 'processed' before any handler ran, so any failure
-- afterwards turned Razorpay's redelivery — the mechanism that exists to recover
-- exactly this — into a silent no-op.
alter table webhook_events drop constraint if exists webhook_events_status_check;
alter table webhook_events add constraint webhook_events_status_check
  check (status in ('received', 'processed', 'duplicate', 'unmatched', 'deferred', 'dead_letter'));
alter table webhook_events alter column status set default 'received';
