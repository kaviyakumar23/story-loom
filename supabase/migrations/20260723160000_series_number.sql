-- Series position for the hero's bookshelf and the printed spine/bookplate
-- ("Book N in {nickname}'s MoonBell Adventures"). Stamped once at payment as
-- 1 + the count of the hero's already-purchased books. Must start at Book 1 —
-- sold hardcovers can't be renumbered — so this ships before launch. Additive.
alter table books add column if not exists series_number int;
