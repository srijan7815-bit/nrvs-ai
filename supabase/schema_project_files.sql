-- NRVS AI — project files + thread assignment. Run in Supabase SQL Editor. Paste-safe.

-- Link threads to a project (optional).
alter table public.threads add column if not exists project_id uuid;

-- Files uploaded to a project (shared across all of that project's threads).
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  content text,
  created_at timestamptz not null default now()
);
create index if not exists project_files_proj_idx on public.project_files (project_id, created_at desc);
alter table public.project_files enable row level security;
drop policy if exists project_files_owner_all on public.project_files;
create policy project_files_owner_all on public.project_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
