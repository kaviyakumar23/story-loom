-- Print masters, and the numbers that decide whether one is usable.
--
-- `assets` has always had width/height columns; nothing ever filled them,
-- because the image provider returned hard-coded zeros. So the system could not
-- tell a print-ready render from one that would come off the press soft —
-- resolution being invisible on a screen and permanent on paper. They are
-- populated from the actual bytes now; this migration only adds what was missing.

-- The press file is a different artifact from the reader's copy: full bleed,
-- embedded fonts, trim boxes, an output intent. Storing it under the same 'pdf'
-- type would make "which file did we send the printer?" unanswerable.
alter table assets drop constraint if exists assets_type_check;
alter table assets add constraint assets_type_check
  check (type in ('image', 'pdf', 'audio', 'character_sheet', 'print_master', 'casewrap', 'preflight'));

-- Content hash of a released file. A release record points at a specific set of
-- bytes, so a reprint can prove it used the same ones.
alter table assets add column if not exists sha256 text;

-- Existing image rows keep NULL dimensions: they were never captured and cannot
-- be reconstructed. Anything print-bound is generated after this point.
