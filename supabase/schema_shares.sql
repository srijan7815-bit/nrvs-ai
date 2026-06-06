-- NRVS AI — Shared chats (public links). Run in Supabase SQL Editor.
-- Paste-safe: no dollar-quoted functions.
--
-- Both snapshot and live shares store the conversation in `snapshot` (jsonb).
-- Live shares are re-synced by the owner's app whenever they view the thread,
-- so anonymous viewers never need direct access to the messages table.

create table if not exists public.shared_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid,
  title text not null default 'Shared chat',
  mode text not null default 'snapshot',
  snapshot jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists shared_chats_user_idx on public.shared_chats (user_id, created_at desc);
create index if not exists shared_chats_thread_idx on public.shared_chats (thread_id);

alter table public.shared_chats enable row level security;

-- Owner can manage their own shares.
drop policy if exists shared_owner_all on public.shared_chats;
create policy shared_owner_all on public.shared_chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone (including anonymous) can READ any share row — powers the public link.
drop policy if exists shared_public_read on public.shared_chats;
create policy shared_public_read on public.shared_chats
  for select using (true);
