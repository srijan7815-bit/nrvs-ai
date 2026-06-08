-- ============================================================
-- NRVS SECURITY: Row-Level Security (RLS) Policies
-- Run this in your Supabase SQL Editor (SQL Editor > New Query)
-- ============================================================
-- IMPORTANT: RLS is DISABLED by default on new tables.
-- These policies ensure NO data is accessible without auth.
-- Even if a hacker has the anon key, they can only access their own rows.
-- ============================================================

-- ─────────────────────────────────────────────
-- Enable RLS on ALL user-data tables
-- ─────────────────────────────────────────────

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares      ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────

-- Users can only read their own profile.
CREATE POLICY "users_read_own_profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Users can only update their own profile.
CREATE POLICY "users_update_own_profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can only insert their own profile (upsert their row).
CREATE POLICY "users_insert_own_profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────
-- THREADS
-- ─────────────────────────────────────────────

-- Users can only see their own threads.
CREATE POLICY "users_read_own_threads"
ON threads FOR SELECT
USING (auth.uid() = user_id);

-- Users can only create threads for themselves.
CREATE POLICY "users_insert_own_threads"
ON threads FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own threads.
CREATE POLICY "users_update_own_threads"
ON threads FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own threads.
CREATE POLICY "users_delete_own_threads"
ON threads FOR DELETE
USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────

-- Users can only see messages in their own threads.
CREATE POLICY "users_read_own_messages"
ON messages FOR SELECT
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = messages.thread_id
    AND threads.user_id = auth.uid()
  )
);

-- Users can only insert messages into their own threads.
CREATE POLICY "users_insert_own_messages"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = thread_id
    AND threads.user_id = auth.uid()
  )
);

-- Users can only update their own messages.
CREATE POLICY "users_update_own_messages"
ON messages FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own messages.
CREATE POLICY "users_delete_own_messages"
ON messages FOR DELETE
USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- FLOWS
-- ─────────────────────────────────────────────

CREATE POLICY "users_read_own_flows"
ON flows FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_flows"
ON flows FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_flows"
ON flows FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_flows"
ON flows FOR DELETE
USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- MEMORIES
-- ─────────────────────────────────────────────

CREATE POLICY "users_read_own_memories"
ON memories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_memories"
ON memories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_memories"
ON memories FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_memories"
ON memories FOR DELETE
USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────

CREATE POLICY "users_read_own_projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_projects"
ON projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_projects"
ON projects FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_projects"
ON projects FOR DELETE
USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- SECRETS
-- ─────────────────────────────────────────────

CREATE POLICY "users_read_own_secrets"
ON secrets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_secrets"
ON secrets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_secrets"
ON secrets FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_secrets"
ON secrets FOR DELETE
USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- API KEYS
-- ─────────────────────────────────────────────

CREATE POLICY "users_read_own_api_keys"
ON api_keys FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_api_keys"
ON api_keys FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_api_keys"
ON api_keys FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_api_keys"
ON api_keys FOR DELETE
USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- SHARES (publicly readable by ID but only
-- manageable by the owner)
-- ─────────────────────────────────────────────

-- Anyone can read a share record (by ID) for shared chat viewing.
-- The actual content is protected by the thread+message RLS above.
CREATE POLICY "users_read_own_shares"
ON shares FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_shares"
ON shares FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_shares"
ON shares FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_shares"
ON shares FOR DELETE
USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Disable anonymous (anon role) access entirely
-- The anon key should only be used for auth operations
-- (magic link, OAuth), NOT for data reads.
-- ─────────────────────────────────────────────

-- Revoke all access from the anon role on user tables
-- (Supabase creates an "anon" role for the anon key by default)

REVOKE ALL ON profiles FROM anon;
REVOKE ALL ON threads FROM anon;
REVOKE ALL ON messages FROM anon;
REVOKE ALL ON flows FROM anon;
REVOKE ALL ON memories FROM anon;
REVOKE ALL ON projects FROM anon;
REVOKE ALL ON secrets FROM anon;
REVOKE ALL ON api_keys FROM anon;
REVOKE ALL ON shares FROM anon;

REVOKE ALL ON profiles FROM authenticated;
-- Note: we still want authenticated users to have their RLS-filtered access
-- so we grant back SELECT/INSERT/UPDATE/DELETE for them
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON flows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON memories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON secrets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shares TO authenticated;