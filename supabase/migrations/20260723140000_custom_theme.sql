-- Parent-authored custom story theme (optional free text, ≤200 chars). It is
-- injection-hardened at the prompt layer (wrapped in <theme> data delimiters,
-- angle brackets stripped) and content-moderated at input. Additive & safe.
alter table books add column if not exists custom_theme text;
