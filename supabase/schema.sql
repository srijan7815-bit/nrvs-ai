-- ─────────────────────────────────────────────────────────────
-- NRVS AI — Supabase schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- ─────────────────────────────────────────────────────────────

-- THREADS ------------------------------------------------------
create table if not exists public.threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'New thread',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists threads_user_updated_idx
  on public.threads (user_id, updated_at desc);

-- MESSAGES -----------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null default '',
  image       text,            -- optional data URL for attachments
  model       text,            -- model id used for assistant turns
  created_at  timestamptz not null default now()
);

create index if not exists messages_thread_created_idx
  on public.messages (thread_id, created_at asc);

-- PROFILES (preferences) --------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  prefs       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ROW LEVEL SECURITY ------------------------------------------
alter table public.threads  enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;

-- threads policies
drop policy if exists "threads_owner_all" on public.threads;
create policy "threads_owner_all" on public.threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages policies
drop policy if exists "messages_owner_all" on public.messages;
create policy "messages_owner_all" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles policies
drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- keep threads.updated_at fresh on new messages
create or replace function public.touch_thread_updated_at()
returns trigger language plpgsql security definer as $$
begin
  update public.threads set updated_at = now() where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_thread on public.messages;
create trigger messages_touch_thread
  after insert on public.messages
  for each row execute function public.touch_thread_updated_at();
