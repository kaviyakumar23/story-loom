-- Post-purchase page editing (§ preview-and-edit).
--
-- render_credits: a small budget of per-page image regenerations granted at
-- payment. Text edits are free; only re-rendering an illustration debits this,
-- because images are ~90% of generation cost. Refunded if a regen is blocked.
--
-- editing_at: set while a page edit is being applied (PDF re-assembly runs
-- async), cleared when done — lets the reader show an "updating…" state without
-- overloading the generation status. The edit window itself is gated on the
-- existing fulfillments.status ('print_ready' = still editable), so no separate
-- print-status column is needed.
alter table books add column if not exists render_credits int not null default 0;
alter table books add column if not exists editing_at timestamptz;
