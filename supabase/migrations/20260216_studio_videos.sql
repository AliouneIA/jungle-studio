-- ============================================================
-- TABLE : studio_videos
-- POURQUOI : Stocker chaque vidéo générée avec son statut,
-- son prompt, et l'URL finale. Comme studio_images mais pour
-- les vidéos. Le champ status est crucial car la génération
-- vidéo est ASYNCHRONE (30s à 2min).
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_videos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    
    -- Contenu
    prompt text NOT NULL,
    video_url text,                -- URL finale de la vidéo (null tant que pas prête)
    thumbnail_url text,            -- Miniature extraite ou générée
    
    -- Paramètres de génération
    model text NOT NULL DEFAULT 'grok-video',  -- 'grok-video' | 'veo-3.1'
    mode text NOT NULL DEFAULT 'create',       -- 'create' | 'edit' | 'motion'
    duration integer DEFAULT 5,                -- Durée en secondes (5, 8, 10)
    aspect_ratio text DEFAULT '16:9',          -- '16:9' | '9:16' | '1:1'
    quality text DEFAULT '720p',               -- '720p' | '1080p'
    
    -- Images source (optionnel)
    start_frame_url text,          -- Image de début (image-to-video)
    end_frame_url text,            -- Image de fin
    source_video_url text,         -- Vidéo source (pour edit/motion)
    character_image_url text,      -- Image personnage (pour motion)
    
    -- Statut async
    status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'done' | 'failed'
    provider_task_id text,         -- ID de la tâche côté Grok/Veo pour le polling
    error_message text,            -- Message d'erreur si échec
    
    -- Options
    sound_enabled boolean DEFAULT true,
    multi_shot boolean DEFAULT false,
    
    -- Métadonnées
    batch_id uuid,                 -- Pour grouper des générations ensemble
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz       -- Quand la vidéo est prête
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_studio_videos_user ON studio_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_videos_status ON studio_videos(status);
CREATE INDEX IF NOT EXISTS idx_studio_videos_task ON studio_videos(provider_task_id);

-- RLS : chaque user voit uniquement ses vidéos
ALTER TABLE studio_videos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'studio_videos' AND policyname = 'Users manage own videos'
    ) THEN
        CREATE POLICY "Users manage own videos" ON studio_videos
            FOR ALL USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Activer Realtime pour le polling côté frontend
-- POURQUOI : Quand l'Edge Function met à jour le status de 'processing' à 'done',
-- le frontend reçoit l'update en temps réel via Supabase Realtime,
-- comme pour Manus.
ALTER PUBLICATION supabase_realtime ADD TABLE studio_videos;

-- Configuration de l'accès à Storage pour le bucket 'studio'
-- On s'assure que l'utilisateur peut uploader dans son propre dossier
INSERT INTO storage.buckets (id, name, public) 
VALUES ('studio', 'studio', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own video frames"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'studio' AND (storage.foldername(name))[1] = 'video-frames' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "Users can view their own video frames"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'studio' AND (storage.foldername(name))[1] = 'video-frames' AND (storage.foldername(name))[2] = auth.uid()::text);
