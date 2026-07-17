-- Migration: Add user_id FK to tb_map_user_role for robust user matching
-- Backward-compatible: existing rows still work via name-based fallback in app code

-- 1. Add nullable user_id column (FK to users)
ALTER TABLE tb_map_user_role
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_tb_map_user_role_user_id ON tb_map_user_role(user_id);

-- 3. Backfill: match existing name values against users table
--    Priority: full_name (Thai) > emp_id (numeric) > nickname prefix (English)
UPDATE tb_map_user_role m
SET user_id = u.id
FROM users u
WHERE m.user_id IS NULL
  AND (
    u.full_name = m.name
    OR u.emp_id = m.name
    OR lower(split_part(u.nickname, '_', 1)) = lower(m.name)
    OR (u.nickname ~ '^\d+$' AND u.nickname = m.name)
  );
