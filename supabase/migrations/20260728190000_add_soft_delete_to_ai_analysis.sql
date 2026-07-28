-- Migration: Add Soft Delete & 7-Day Trash Retention to tb_ai_individual_analysis

BEGIN;

-- 1. Add soft delete columns
ALTER TABLE public.tb_ai_individual_analysis
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT null;

-- 2. Index for filtering active vs soft-deleted records
CREATE INDEX IF NOT EXISTS idx_ai_analysis_soft_delete 
  ON public.tb_ai_individual_analysis (user_id, is_deleted, deleted_at);

-- 3. Update public shared RLS policy to ignore soft-deleted records
DROP POLICY IF EXISTS "Public read shared individual analysis" ON public.tb_ai_individual_analysis;
CREATE POLICY "Public read shared individual analysis" 
  ON public.tb_ai_individual_analysis 
  FOR SELECT 
  USING (is_public = true AND expires_at > now() AND (is_deleted IS NULL OR is_deleted = false));

-- 4. RPC to auto-purge records in trash older than 7 days
CREATE OR REPLACE FUNCTION public.purge_expired_ai_analysis()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.tb_ai_individual_analysis
  WHERE is_deleted = true
    AND deleted_at IS NOT NULL
    AND deleted_at < (NOW() - INTERVAL '7 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_expired_ai_analysis() TO authenticated, anon;

COMMIT;
