-- Scope consent records so a parent can grant (and withdraw) different consents
-- independently — e.g. the base book-creation consent vs. a future opt-in photo
-- likeness consent. Additive & safe: existing rows default to 'book_creation'.
alter table consent_records add column if not exists scope text not null default 'book_creation';

create index if not exists idx_consent_parent_scope on consent_records (parent_id, scope) where withdrawn_at is null;
