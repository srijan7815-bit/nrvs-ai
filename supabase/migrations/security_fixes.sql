-- ============================================================
-- NRVS Security Fix: Lock down shared_chats from anon access
-- Also fix api_keys schema mismatch (key column vs value column)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Block anon role from reading shared_chats ──
-- Shared chats are now served through the serverless API (/api/share/:id)
-- using the service role key, so the anon key does NOT need access.
REVOKE ALL ON shared_chats FROM anon;

-- Ensure authenticated users still have access via RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON shared_chats TO authenticated;

-- ── 2. Fix api_keys table: ensure the column is named `key` not `value` ──
-- The codebase uses `key` column but the migration created `value`.
-- Check and fix the column name mismatch.
DO $$
BEGIN
  -- If `value` column exists but `key` does not, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'value'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    ALTER TABLE api_keys RENAME COLUMN value TO key;
    -- Re-add unique constraint on key
    CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_idx ON api_keys (key);
  END IF;
END
$$;

-- ── 3. Ensure the `last_used_at` column exists on api_keys ──
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- ── 4. Add a `shared_chats` table if it doesn't exist (the code uses this name) ──
CREATE TABLE IF NOT EXISTS public.shared_chats (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  thread_id   UUID,
  title       TEXT        NOT NULL DEFAULT 'Shared chat',
  mode        TEXT        DEFAULT 'snapshot',
  snapshot    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE shared_chats ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_shared_chats_user_id ON shared_chats(user_id);

-- RLS for shared_chats: owner can CRUD
DROP POLICY IF EXISTS shared_chats_owner_all ON shared_chats;
CREATE POLICY shared_chats_owner_all ON shared_chats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 5. Ensure `shared` column exists on threads ──
ALTER TABLE threads ADD COLUMN IF NOT EXISTS shared BOOLEAN DEFAULT false;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS project_id UUID;

-- ── 6. Revoke all remaining anon access for safety ──
REVOKE ALL ON shared_chats FROM anon;
REVOKE ALL ON threads FROM anon;
REVOKE ALL ON messages FROM anon;
REVOKE ALL ON profiles FROM anon;
REVOKE ALL ON memories FROM anon;
REVOKE ALL ON projects FROM anon;
REVOKE ALL ON secrets FROM anon;
REVOKE ALL ON api_keys FROM anon;
REVOKE ALL ON flows FROM anon;
REVOKE ALL ON library_items FROM anon;
REVOKE ALL ON project_files FROM anon;
