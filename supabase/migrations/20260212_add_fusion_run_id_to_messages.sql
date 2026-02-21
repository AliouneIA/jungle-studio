-- Migration: Add fusion_run_id to messages
-- Permet de lier un message assistant au run de fusion correspondant pour l'historique de réflexion.

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS fusion_run_id uuid REFERENCES public.fusion_runs(id) ON DELETE SET NULL;

-- Création d'un index pour optimiser les jointures
CREATE INDEX IF NOT EXISTS messages_fusion_run_id_idx ON public.messages(fusion_run_id);
