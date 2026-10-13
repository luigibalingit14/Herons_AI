-- Theme is presentation metadata, so it must not reject notebook creation
-- when the UI introduces a new theme label.
alter table public.notebooks drop constraint if exists notebooks_theme_check;
