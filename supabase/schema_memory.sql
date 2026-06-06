-- ─────────────────────────────────────────────────────────────
-- NRVS AI — Memory feature (run AFTER the main schema)
-- Supabase → SQL Editor → New query → paste ALL → Run.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  source text not null default 'manual' check (source in ('manual','auto')),
  created_at timestamptz not null default now()
);

create index if not exists memories_user_created_idx on public.memories (user_id, created_at desc);

alter table public.memories enable row level security;

drop policy if exists "memories_owner_all" on public.memories;
create policy "memories_owner_all" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
