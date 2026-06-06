-- NRVS AI — User secrets vault + saved library artifacts. Run in Supabase SQL Editor.
-- Paste-safe (no dollar-quoted functions).

-- Secrets (tokens/keys) — RLS so only the owner can read/write.
create table if not exists public.secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  value text not null,
  created_at timestamptz not null default now()
);
create index if not exists secrets_user_idx on public.secrets (user_id, created_at desc);
alter table public.secrets enable row level security;
drop policy if exists secrets_owner_all on public.secrets;
create policy secrets_owner_all on public.secrets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Library artifacts saved from chats.
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Artifact',
  kind text not null default 'html',
  content text not null default '',
  thread_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists library_user_idx on public.library_items (user_id, created_at desc);
alter table public.library_items enable row level security;
drop policy if exists library_owner_all on public.library_items;
create policy library_owner_all on public.library_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Projects.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text default '',
  created_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, created_at desc);
alter table public.projects enable row level security;
drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
