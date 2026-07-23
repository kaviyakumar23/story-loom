-- Defense in depth: photo_uploads.status defaulted to 'approved', so any future
-- insert path that forgot to set status would land a photo pre-approved —
-- against the "moderation fails closed" non-negotiable. The upload route always
-- sets status explicitly, so this changes no behavior today; it just makes the
-- schema fail SAFE. Additive & safe (feature is flag-gated OFF anyway).
alter table photo_uploads alter column status set default 'pending_moderation';
