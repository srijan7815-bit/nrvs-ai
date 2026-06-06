-- NRVS AI — Memory + Profile name (paste-safe, no CHECK constraints)
-- Run in: Supabase → SQL Editor → New query → paste ALL → Run.

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists memories_user_created_idx on public.memories (user_id, created_at desc);

alter table public.memories enable row level security;

drop policy if exists "memories_owner_all" on public.memories;
create policy "memories_owner_all" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Add a display_name column to profiles for the greeting.
alter table public.profiles add column if not exists display_name text;
