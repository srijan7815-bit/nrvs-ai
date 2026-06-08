-- ============================================================
-- NRVS: Create all tables WITH RLS enabled from the start
-- Run this ONLY if some tables are missing.
-- If tables already exist, skip this file.
-- ============================================================

-- ── PROFILES ──
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  onboarded   BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── THREADS ──
CREATE TABLE IF NOT EXISTS threads (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT        NOT NULL DEFAULT 'New thread',
  shared      BOOLEAN     DEFAULT false,
  project_id  UUID,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);

-- ── MESSAGES ──
CREATE TABLE IF NOT EXISTS messages (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id   UUID        REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role        TEXT        NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  image       TEXT,
  model       TEXT,
  tools       JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- ── FLOWS ──
CREATE TABLE IF NOT EXISTS flows (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  objective   TEXT        NOT NULL,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id);

-- ── MEMORIES ──
CREATE TABLE IF NOT EXISTS memories (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content     TEXT        NOT NULL,
  source      TEXT        DEFAULT 'manual',
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);

-- ── PROJECTS ──
CREATE TABLE IF NOT EXISTS projects (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  files       JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- ── SECRETS ──
CREATE TABLE IF NOT EXISTS secrets (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_secrets_user_id ON secrets(user_id);

-- ── API KEYS ──
CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- ── SHARES ──
CREATE TABLE IF NOT EXISTS shares (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  thread_id   UUID        REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_thread_id ON shares(thread_id);