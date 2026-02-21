-- Migration: Add Manus-specific columns to messages
-- Permet de stocker l'état et les données des agents Manus pour une persistance fiable.

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_manus boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manus_status text,
ADD COLUMN IF NOT EXISTS manus_task_id text,
ADD COLUMN IF NOT EXISTS manus_task_url text,
ADD COLUMN IF NOT EXISTS manus_structured jsonb;

-- Commentaire pour documentation
COMMENT ON COLUMN public.messages.manus_structured IS 'Contient les données structurées renvoyées par Manus (plan, outils, etc.)';
