-- Migration pour les présentations générées par IA (Canvas)
CREATE TABLE IF NOT EXISTS public.canvas_presentations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sans titre',
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_canvas_presentations_user_id ON public.canvas_presentations(user_id);

-- RLS
ALTER TABLE public.canvas_presentations ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own presentations' AND tablename = 'canvas_presentations') THEN
        CREATE POLICY "Users can view own presentations" ON public.canvas_presentations
          FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own presentations' AND tablename = 'canvas_presentations') THEN
        CREATE POLICY "Users can insert own presentations" ON public.canvas_presentations
          FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own presentations' AND tablename = 'canvas_presentations') THEN
        CREATE POLICY "Users can update own presentations" ON public.canvas_presentations
          FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own presentations' AND tablename = 'canvas_presentations') THEN
        CREATE POLICY "Users can delete own presentations" ON public.canvas_presentations
          FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
