-- ==========================================
-- Migration: Add Coffee Boost Count to Users Table
-- ==========================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS coffee_boost_count INTEGER DEFAULT 0;
