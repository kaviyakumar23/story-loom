-- Row-level security (§9 access control), defense-in-depth.
--
-- The backend talks to Postgres with the service-role key, which BYPASSES RLS;
-- it owner-scopes every query in code. These policies are a second layer that
-- protects against (a) any code path that forgets to scope, and (b) direct use
-- of an anon/user JWT (e.g. if the frontend ever queries Supabase directly).
--
-- Model: a row is visible to the parent whose auth uid matches parent_id.
-- Operational tables (audit_log, generation_events, payments, raw webhook data)
-- are service-role only — no parent-facing policy, so they are invisible to
-- user JWTs entirely.

alter table profiles          enable row level security;
alter table consent_records   enable row level security;
alter table heroes            enable row level security;
alter table character_sheets  enable row level security;
alter table books             enable row level security;
alter table book_pages        enable row level security;
alter table assets            enable row level security;
alter table orders            enable row level security;
alter table payments          enable row level security;
alter table generation_events enable row level security;
alter table audit_log         enable row level security;
alter table deletion_requests enable row level security;
-- Parent owns their profile.
create policy profiles_owner on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
-- Direct-ownership tables.
create policy consent_owner on consent_records
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy heroes_owner on heroes
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy books_owner on books
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy orders_owner on orders
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy deletion_owner on deletion_requests
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
-- Tables owned transitively through a parent row.
create policy sheets_owner on character_sheets
  for all using (
    exists (select 1 from heroes h where h.id = character_sheets.hero_id and h.parent_id = auth.uid())
  );
create policy pages_owner on book_pages
  for all using (
    exists (select 1 from books b where b.id = book_pages.book_id and b.parent_id = auth.uid())
  );
create policy assets_owner on assets
  for select using (
    (book_id is not null and exists (select 1 from books b where b.id = assets.book_id and b.parent_id = auth.uid()))
    or (hero_id is not null and exists (select 1 from heroes h where h.id = assets.hero_id and h.parent_id = auth.uid()))
  );
-- payments, generation_events, audit_log: no parent policy => service-role only.;
