-- Narrow paid beta: intake + correction changes.
--
-- 1. A dedication. The printed book has a dedication page in its front matter,
--    so the line has to be collected at intake — the existing gift message is
--    collected at checkout and belongs to the gifting flow, not the book block.
alter table books add column if not exists dedication text;

-- 2. Corrections become founder-reviewed. A parent may still ask for exactly one
--    change (the unique index below already enforces that), but the request now
--    lands in a review queue instead of immediately re-running generation:
--    nothing reaches the printer that a human has not seen.
--
--    'pending_review' is the new entry state and 'rejected' its terminal
--    counterpart; the original queued/running/completed/failed states still
--    describe a run once it has been approved.
alter table book_revision_requests drop constraint if exists book_revision_requests_status_check;
alter table book_revision_requests add constraint book_revision_requests_status_check
  check (status in ('pending_review', 'rejected', 'queued', 'running', 'completed', 'failed'));

alter table book_revision_requests add column if not exists reviewed_at timestamptz;
alter table book_revision_requests add column if not exists review_note text;

-- The founder's queue reads by state, oldest first.
create index if not exists idx_revision_requests_pending
  on book_revision_requests (created_at)
  where status = 'pending_review';
