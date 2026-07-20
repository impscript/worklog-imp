-- Migration: Add dimension_scores column to tb_ai_individual_analysis
-- Stores per-dimension structured scores: rationale, improvement_suggestions, etc.
BEGIN;

ALTER TABLE public.tb_ai_individual_analysis
  ADD COLUMN IF NOT EXISTS dimension_scores JSONB DEFAULT NULL;

COMMENT ON COLUMN public.tb_ai_individual_analysis.dimension_scores IS
  'Array of per-dimension score objects: {dimension, dimension_th, weight_pct, raw_score, weighted_score, rationale, improvement_suggestions}';

COMMIT;
