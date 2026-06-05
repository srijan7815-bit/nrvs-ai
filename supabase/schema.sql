-- ─────────────────────────────────────────────────────────────
-- NRVS AI — Supabase schema (paste-safe, no dollar-quoting)
-- Run in: Supabase → SQL Editor → New query → paste ALL → Run.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New thread',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists threads_user_updated_idx on public.threads (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  image text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_created_idx on public.messages (thread_id, created_at asc);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.threads  enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "threads_owner_all" on public.threads;
create policy "threads_owner_all" on public.threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "messages_owner_all" on public.messages;
create policy "messages_owner_all" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
