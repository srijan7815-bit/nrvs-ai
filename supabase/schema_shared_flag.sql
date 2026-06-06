-- NRVS AI — add `shared` flag to threads (for continued/forked shared chats).
-- Paste-safe. Run in Supabase SQL Editor.
alter table public.threads add column if not exists shared boolean not null default false;
