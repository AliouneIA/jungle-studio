-- Migration Step 2: Infrastructure Webhooks Manus
-- Création de la table de progression et ajout des colonnes de statut

CREATE TABLE IF NOT EXISTS public.manus_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id text NOT NULL,
  progress_type text,
  message text,
  received_at timestamptz DEFAULT now()
);

-- Ajouter colonnes à messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS manus_status_text text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS manus_attachments jsonb DEFAULT '[]';

-- Activer Realtime sur les tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.manus_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
