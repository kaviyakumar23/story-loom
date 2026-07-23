-- Optional child-photo likeness (feature-flagged OFF). A photo is EPHEMERAL
-- intake: moderated before use, sent to the image model once (Vertex only) to
-- seed a stylized character sheet, then deleted within minutes (24h hard TTL).
-- This table tracks only the lifecycle + storage key; the bytes live in the
-- separate private 'photo-intake' bucket and are never signed or served.
create table if not exists photo_uploads (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references profiles (id) on delete cascade,
  hero_id      uuid references heroes (id) on delete cascade,
  consent_id   uuid references consent_records (id),
  storage_key  text not null,
  status       text not null default 'approved'
                 check (status in ('pending_moderation', 'approved', 'rejected', 'consumed', 'expired')),
  moderation   jsonb,
  created_at   timestamptz not null default now(),
  consumed_at  timestamptz,
  deleted_at   timestamptz
);
alter table photo_uploads enable row level security;
-- Parents may see their own upload STATUS (metadata only); bytes are never served.
create policy photo_uploads_owner on photo_uploads for select using (parent_id = auth.uid());
create index if not exists idx_photo_uploads_hero on photo_uploads (hero_id)
  where status = 'approved' and consumed_at is null and deleted_at is null;
create index if not exists idx_photo_uploads_purge on photo_uploads (created_at) where deleted_at is null;

-- Lineage: which sheets were seeded from a photo, under which consent — so a
-- likeness can be withdrawn and audited independently of attribute-only sheets.
alter table character_sheets add column if not exists source text not null default 'attributes'
  check (source in ('attributes', 'photo'));
alter table character_sheets add column if not exists consent_id uuid references consent_records (id);
