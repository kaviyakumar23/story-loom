-- Wider beta readiness: parent guide, occasion packs, private preview sharing,
-- and one controlled preview tweak before checkout.

alter table books
  add column if not exists occasion_pack text;

alter table books
  drop constraint if exists books_occasion_pack_check;

alter table books
  add constraint books_occasion_pack_check
  check (
    occasion_pack is null or occasion_pack in (
      'first_day_school',
      'braver_bedtime',
      'new_sibling',
      'kindness_reset',
      'reading_win',
      'big_move',
      'english_practice',
      'try_again'
    )
  );

create table if not exists book_reading_guides (
  book_id              uuid primary key references books (id) on delete cascade,
  vocabulary           text[] not null default '{}',
  discussion_questions text[] not null default '{}',
  activity             text,
  updated_at           timestamptz not null default now()
);

create table if not exists book_share_links (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references profiles (id) on delete cascade,
  book_id     uuid not null references books (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_book_share_links_parent on book_share_links (parent_id);
create index if not exists idx_book_share_links_book on book_share_links (book_id);
create index if not exists idx_book_share_links_expires on book_share_links (expires_at);

create table if not exists book_revision_requests (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references profiles (id) on delete cascade,
  book_id      uuid not null references books (id) on delete cascade,
  instruction  text not null,
  status       text not null default 'queued'
                 check (status in ('queued','running','completed','failed')),
  error        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists uq_book_revision_one on book_revision_requests (book_id);
create index if not exists idx_book_revision_parent on book_revision_requests (parent_id);
create index if not exists idx_book_revision_book on book_revision_requests (book_id);

alter table book_events
  drop constraint if exists book_events_event_check;

alter table book_events
  add constraint book_events_event_check
  check (event in (
    'preview_viewed',
    'preview_page_changed',
    'alpha_preview_saved',
    'preview_share_created',
    'preview_share_copied',
    'preview_tweak_requested',
    'download_pdf_clicked',
    'download_audio_clicked'
  ));

alter table book_reading_guides enable row level security;
alter table book_share_links enable row level security;
alter table book_revision_requests enable row level security;

drop policy if exists book_reading_guides_owner on book_reading_guides;
create policy book_reading_guides_owner on book_reading_guides
  for all using (
    exists (
      select 1 from books
      where books.id = book_reading_guides.book_id
        and books.parent_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from books
      where books.id = book_reading_guides.book_id
        and books.parent_id = auth.uid()
    )
  );

drop policy if exists book_share_links_owner on book_share_links;
create policy book_share_links_owner on book_share_links
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

drop policy if exists book_revision_requests_owner on book_revision_requests;
create policy book_revision_requests_owner on book_revision_requests
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
