-- ==========================================
-- Migration: Add Transactional Coffee Boost Table and Migrate Data
-- ==========================================

-- 1. Create table tb_coffee_boost
CREATE TABLE IF NOT EXISTS public.tb_coffee_boost (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tb_coffee_boost ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow full access to tb_coffee_boost for dev" ON public.tb_coffee_boost;
CREATE POLICY "Allow full access to tb_coffee_boost for dev" ON public.tb_coffee_boost FOR ALL USING (true);

-- Migrate existing coffee_boost_count from public.users to public.tb_coffee_boost as June 2026 data
DO $$
DECLARE
    u RECORD;
    i INT;
BEGIN
    FOR u IN SELECT id, coffee_boost_count FROM public.users WHERE coffee_boost_count > 0 LOOP
        FOR i IN 1..u.coffee_boost_count LOOP
            INSERT INTO public.tb_coffee_boost (receiver_id, created_at)
            VALUES (u.id, '2026-06-30 12:00:00+07');
        END LOOP;
    END LOOP;
END $$;
