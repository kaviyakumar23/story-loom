-- Order caps and the price experiment.
--
-- The beta is a capped test, not a soft launch: 75 orders in total, 25 per
-- metro, 3 a day and 15 a week, paused whenever more than five books are
-- waiting on the founder's QC. Those numbers only mean anything if they are
-- enforced where the money is taken — a cap counted in a spreadsheet is a cap
-- that gets exceeded on the day it matters.

-- ---------------------------------------------------------------------------
-- Which price a visitor sees, decided once and remembered.
--
-- A price that changes between the landing page and checkout is a broken
-- promise, so the arm is assigned on first visit and stored against an opaque
-- visitor id. Nothing here identifies a person: the cookie is a random uuid and
-- the row holds no other attribute.
create table if not exists price_arm_assignments (
  visitor_id  uuid primary key,
  arm         text not null check (arm in ('A', 'B')),
  block_seq   bigint not null,
  metro       text,
  assigned_at timestamptz not null default now()
);
alter table price_arm_assignments enable row level security;

-- Alternating blocks rather than a coin flip. With a sample this small, random
-- assignment can easily deal 60/40 and leave the comparison unreadable; a
-- sequence keeps the arms level as they fill.
create sequence if not exists price_arm_block_seq;

-- Callable from the app: a sequence read is the whole point of the balance.
create or replace function next_price_arm_block()
returns bigint
language sql
as $$ select nextval('price_arm_block_seq'); $$;
revoke execute on function next_price_arm_block() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Claim a slot, or say precisely why not.
--
-- Under an advisory lock, so two people checking out at the same instant cannot
-- both take the 75th slot. Counts orders that are paid OR recently created: a
-- checkout in progress is holding a slot it has not paid for yet, and ignoring
-- those would let a burst overshoot the cap.
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
  -- An abandoned checkout should not hold a slot for ever.
  v_hold  interval := interval '45 minutes';
begin
  -- One lock for the whole cap check: the numbers have to be read and acted on
  -- as a set, not one at a time.
  perform pg_advisory_xact_lock(hashtext('beta_order_slot'));

  -- A backlog the founder cannot clear is the real capacity limit — the plan
  -- pauses new orders above five books awaiting QC, ahead of any count.
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
     and (status = 'paid' or status = 'created');
  if v_day >= 3 then return 'cap_day'; end if;

  select count(*) into v_week from orders
   where created_at > now() - interval '7 days'
     and (status = 'paid' or status = 'created');
  if v_week >= 15 then return 'cap_week'; end if;

  return 'ok';
end;
$$;
revoke execute on function claim_beta_order_slot(text) from public, anon, authenticated;

-- Counting by metro and by recency is what the cap check does on every checkout.
create index if not exists idx_orders_metro_created on orders (metro, created_at);
create index if not exists idx_orders_status_created on orders (status, created_at);
