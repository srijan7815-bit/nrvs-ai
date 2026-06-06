-- NRVS AI — developer API keys. Run in Supabase SQL Editor. Paste-safe.
-- Users generate keys to call NRVS from outside the app. The serverless API
-- validates a key via a security-definer RPC (so the anon role never reads the table).

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'API key',
  key text not null unique,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_user_idx on public.api_keys (user_id, created_at desc);
create index if not exists api_keys_key_idx on public.api_keys (key);

alter table public.api_keys enable row level security;

-- Owner manages their own keys.
drop policy if exists api_keys_owner_all on public.api_keys;
create policy api_keys_owner_all on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
