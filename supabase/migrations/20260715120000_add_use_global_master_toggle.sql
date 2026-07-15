-- Migration: Add use_global_master toggle column to workspaces table
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS use_global_master BOOLEAN NOT NULL DEFAULT true;
