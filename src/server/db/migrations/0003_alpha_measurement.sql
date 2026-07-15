-- Internal alpha measurement: capture lifecycle timing, preview behavior, and tester feedback.

alter table books
  add column if not exists preview_ready_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists completed_at timestamptz;

create table if not exists book_events (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references profiles (id) on delete cascade,
  book_id    uuid not null references books (id) on delete cascade,
  event      text not null check (event in (
    'preview_viewed',
    'preview_page_changed',
    'alpha_preview_saved',
    'download_pdf_clicked',
    'download_audio_clicked'
  )),
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_book_events_parent on book_events (parent_id);
create index if not exists idx_book_events_book on book_events (book_id);
create index if not exists idx_book_events_event on book_events (event);
create index if not exists idx_book_events_created on book_events (created_at);

create table if not exists book_feedback (
  id                  uuid primary key default gen_random_uuid(),
  parent_id           uuid not null references profiles (id) on delete cascade,
  book_id             uuid not null references books (id) on delete cascade,
  rating              int not null check (rating between 1 and 5),
  issue_type          text not null default 'none' check (issue_type in (
    'none',
    'story_quality',
    'image_quality',
    'safety',
    'technical',
    'other'
  )),
  comments            text,
  wants_full_book     boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists idx_book_feedback_parent on book_feedback (parent_id);
create index if not exists idx_book_feedback_book on book_feedback (book_id);
create index if not exists idx_book_feedback_issue on book_feedback (issue_type);
create index if not exists idx_book_feedback_created on book_feedback (created_at);

alter table book_events enable row level security;
alter table book_feedback enable row level security;

drop policy if exists book_events_owner on book_events;
create policy book_events_owner on book_events
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

drop policy if exists book_feedback_owner on book_feedback;
create policy book_feedback_owner on book_feedback
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
