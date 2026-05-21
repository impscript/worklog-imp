-- Add sharing and acknowledgment columns to tb_ai_individual_analysis
ALTER TABLE public.tb_ai_individual_analysis
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days');

-- Create unique index on share_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analysis_share_token 
  ON public.tb_ai_individual_analysis (share_token);

-- Re-enable RLS if not already enabled (it should be, but let's be sure)
ALTER TABLE public.tb_ai_individual_analysis ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy if exists
DROP POLICY IF EXISTS "Allow public read access to tb_ai_individual_analysis" ON public.tb_ai_individual_analysis;
DROP POLICY IF EXISTS "Users can view their own individual analysis" ON public.tb_ai_individual_analysis;
DROP POLICY IF EXISTS "All users can view all individual analysis" ON public.tb_ai_individual_analysis;

-- Create dynamic security policies
-- 1. Owners / HRBPs can see their records
CREATE POLICY "Users can view their own individual analysis" 
  ON public.tb_ai_individual_analysis
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'hrbp')
    )
  );

-- 2. Public sharing policy (active links only)
CREATE POLICY "Allow public read access to tb_ai_individual_analysis" 
  ON public.tb_ai_individual_analysis
  FOR SELECT 
  USING (
    is_public = TRUE AND expires_at > now()
  );

-- 3. Dynamic Insert policy (users can insert / update their own or admins/hrbps)
DROP POLICY IF EXISTS "Users can insert individual analysis" ON public.tb_ai_individual_analysis;
CREATE POLICY "Users can insert individual analysis" 
  ON public.tb_ai_individual_analysis
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'hrbp')
    )
  );

DROP POLICY IF EXISTS "Users can update individual analysis" ON public.tb_ai_individual_analysis;
CREATE POLICY "Users can update individual analysis" 
  ON public.tb_ai_individual_analysis
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'hrbp')
    )
  );
