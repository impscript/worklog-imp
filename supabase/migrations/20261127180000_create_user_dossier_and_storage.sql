-- Migration: Personal Portfolio Studio (`tb_user_dossier`) + Storage bucket (`dossier-assets`)
--
-- Enables every employee (owner, workspace admin, or global admin) to customize their
-- Editorial Portfolio (`/dossier/:slug`) with track mode (career_review | promotion_track),
-- headline/bio, accent theme, featured project cards with uploaded screenshots, and an
-- optional supervisor endorsement quote.
--
-- Rollback:
--   DROP POLICY IF EXISTS "Public read dossier-assets" ON storage.objects;
--   DROP POLICY IF EXISTS "Authenticated upload dossier-assets" ON storage.objects;
--   DROP POLICY IF EXISTS "Authenticated update dossier-assets" ON storage.objects;
--   DROP POLICY IF EXISTS "Authenticated delete dossier-assets" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'dossier-assets';
--   DROP TABLE IF EXISTS public.tb_user_dossier;

BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_user_dossier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  track_mode TEXT NOT NULL DEFAULT 'career_review'
    CHECK (track_mode IN ('career_review', 'promotion_track')),
  target_role TEXT,
  headline TEXT,
  bio TEXT,
  hero_image_url TEXT,
  accent_theme TEXT NOT NULL DEFAULT 'indigo'
    CHECK (accent_theme IN ('indigo', 'emerald', 'cyan', 'violet')),
  featured_projects JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(featured_projects) = 'array'),
  supervisor_quote TEXT,
  supervisor_name TEXT,
  supervisor_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tb_user_dossier ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read public or owned tb_user_dossier" ON public.tb_user_dossier;
DROP POLICY IF EXISTS "Manage own or workspace member tb_user_dossier" ON public.tb_user_dossier;

CREATE POLICY "Read public or owned tb_user_dossier" ON public.tb_user_dossier
  FOR SELECT
  TO anon, authenticated
  USING (
    is_public = true
    OR user_id = app_security.current_internal_user_id()
    OR app_security.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_users wu
      WHERE wu.user_id = tb_user_dossier.user_id
        AND app_security.is_workspace_admin(wu.workspace_id)
    )
  );

CREATE POLICY "Manage own or workspace member tb_user_dossier" ON public.tb_user_dossier
  FOR ALL
  TO authenticated
  USING (
    user_id = app_security.current_internal_user_id()
    OR app_security.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_users wu
      WHERE wu.user_id = tb_user_dossier.user_id
        AND app_security.is_workspace_admin(wu.workspace_id)
    )
  )
  WITH CHECK (
    user_id = app_security.current_internal_user_id()
    OR app_security.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_users wu
      WHERE wu.user_id = tb_user_dossier.user_id
        AND app_security.is_workspace_admin(wu.workspace_id)
    )
  );

-- Storage bucket for project screenshots and custom hero photos (public read, 5 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dossier-assets',
  'dossier-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read dossier-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload dossier-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update dossier-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete dossier-assets" ON storage.objects;

CREATE POLICY "Public read dossier-assets" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'dossier-assets');

CREATE POLICY "Authenticated upload dossier-assets" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dossier-assets');

CREATE POLICY "Authenticated update dossier-assets" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'dossier-assets');

CREATE POLICY "Authenticated delete dossier-assets" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'dossier-assets');

COMMIT;
