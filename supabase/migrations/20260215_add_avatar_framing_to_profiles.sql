-- Migration pour ajouter les colonnes de cadrage d'avatar et les infos de profil
-- Table: public.profiles

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS avatar_zoom float8 DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS avatar_offset_x float8 DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS avatar_offset_y float8 DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS avatar_sidebar_zoom float8 DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS avatar_sidebar_offset_x float8 DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS avatar_sidebar_offset_y float8 DEFAULT 0.0;

-- Commentaire pour l'utilisateur
-- Copiez-collez ce script dans l'éditeur SQL de Supabase.
