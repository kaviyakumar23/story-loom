-- Funnel events.
--
-- There is currently no instrumentation on the landing page or the create flow
-- at all. The only telemetry that exists needs a book id and a signed-in
-- parent, which means it starts measuring at the exact point where most people
-- have already left. A conversion redesign that cannot measure itself is a
-- redesign we can only have opinions about.
--
-- First-party and deliberately thin. No third-party analytics, no fingerprint,
-- no IP, and — enforced in the API rather than by convention — no free text of
-- any kind, so a child's details cannot ride along in a props blob.
create table if not exists funnel_events (
  id         uuid primary key default gen_random_uuid(),
  -- A random per-browser id from a first-party cookie. Not a person: it says
  -- "these events came from the same visit", nothing more.
  session_id uuid,
  -- Which price this visitor saw, so the funnel can be read per arm.
  arm        text check (arm is null or arm in ('A', 'B')),
  event      text not null,
  path       text,
  -- Numbers and enums only. The API's schema is what enforces that.
  props      jsonb not null default '{}'::jsonb,
  -- Set on server-written events (a captured payment, a shipment) where the
  -- session is unknown but the order is not.
  order_id   uuid,
  book_id    uuid,
  created_at timestamptz not null default now()
);
-- Service-role only. These rows are ours to aggregate, not anyone's to read.
alter table funnel_events enable row level security;

create index if not exists idx_funnel_events_time on funnel_events (created_at);
create index if not exists idx_funnel_events_event on funnel_events (event, created_at);
create index if not exists idx_funnel_events_session on funnel_events (session_id, created_at);
