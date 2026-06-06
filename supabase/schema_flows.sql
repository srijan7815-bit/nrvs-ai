-- NRVS AI — Flow State missions. Run in Supabase SQL Editor. Paste-safe.
create table if not exists public.flows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  objective text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flows_user_idx on public.flows (user_id, updated_at desc);
alter table public.flows enable row level security;
drop policy if exists flows_owner_all on public.flows;
create policy flows_owner_all on public.flows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
