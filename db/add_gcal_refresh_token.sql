-- Migration: Add Google Calendar OAuth Refresh Token column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gcal_refresh_token text;
