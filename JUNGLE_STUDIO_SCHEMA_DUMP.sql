-- ==========================================================
-- JUNGLE STUDIO - COMPLETE DATABASE SCHEMA (FEBRUARY 2026)
-- ==========================================================

-- 1. EXTENSIONS & UTILS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  new.updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 2. PROJECTS & PROFILES
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) NOT NULL PRIMARY KEY,
  email text,
  username text,
  avatar_url text, -- Added for profile pictures
  credits int DEFAULT 100,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 3. CHAT SYSTEM
CREATE TABLE public.conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text,
  mode text DEFAULT 'chat', -- Added for mode selection (chat, fusion, etc)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text,
  is_fusion_result boolean DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb, -- Store list of file URLs
  manus_task_id text, -- Added for Manus integration
  manus_status text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own messages" ON public.messages FOR ALL USING (auth.uid() = user_id);

-- 4. IA CONFIGURATION (Providers & Models)
CREATE TABLE public.providers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL
);
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read only providers" ON public.providers FOR SELECT USING (true);

CREATE TABLE public.models (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id uuid REFERENCES public.providers(id) NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean DEFAULT true
);
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read only models" ON public.models FOR SELECT USING (true);

-- 5. STUDIO & GENERATION
CREATE TABLE public.generated_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  prompt text NOT NULL,
  model_slug text NOT NULL,
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own images" ON public.generated_images FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.studio_videos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    prompt text NOT NULL,
    video_url text,
    thumbnail_url text,
    model text NOT NULL DEFAULT 'grok-video',
    mode text NOT NULL DEFAULT 'create',
    duration integer DEFAULT 5,
    aspect_ratio text DEFAULT '16:9',
    status text NOT NULL DEFAULT 'pending',
    provider_task_id text,
    error_message text,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);
ALTER TABLE public.studio_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own videos" ON public.studio_videos FOR ALL USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE studio_videos;

CREATE TABLE public.studio_styles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.studio_styles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own styles" ON public.studio_styles FOR ALL USING (auth.uid() = user_id);

-- 6. CANVAS & PRESENTATIONS
CREATE TABLE public.canvas_artifacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Document sans titre',
  kind text NOT NULL CHECK (kind IN ('doc', 'code', 'presentation')),
  language text,
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.canvas_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own artifacts" ON public.canvas_artifacts FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER set_artifacts_updated_at BEFORE UPDATE ON public.canvas_artifacts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.canvas_presentations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sans titre',
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.canvas_presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own presentations" ON public.canvas_presentations FOR ALL USING (auth.uid() = user_id);

-- 7. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('studio', 'studio', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat_attachments', 'chat_attachments', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('generated_images', 'generated_images', true) ON CONFLICT (id) DO NOTHING;

-- 8. TRIGGERS & FUNCTIONS
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9. SEED DATA
DO $$
declare
  openai_id uuid;
  google_id uuid;
  anthropic_id uuid;
  xai_id uuid;
begin
  -- Providers
  INSERT INTO public.providers (slug, name) VALUES 
    ('openai', 'OpenAI'), ('google', 'Google'), ('anthropic', 'Anthropic'), ('xai', 'xAI (Grok)')
  ON CONFLICT (slug) DO NOTHING;
  
  SELECT id INTO openai_id FROM public.providers WHERE slug = 'openai';
  SELECT id INTO google_id FROM public.providers WHERE slug = 'google';
  SELECT id INTO anthropic_id FROM public.providers WHERE slug = 'anthropic';
  SELECT id INTO xai_id FROM public.providers WHERE slug = 'xai';

  -- Models
  INSERT INTO public.models (provider_id, slug, name) VALUES
    (openai_id, 'gpt-4o', 'GPT-4 Omni'),
    (openai_id, 'gpt-5.2', 'GPT-5.2 (Feb 2026)'),
    (anthropic_id, 'claude-3-5-sonnet', 'Claude 3.5 Sonnet'),
    (anthropic_id, 'claude-sonnet-4-5', 'Claude 4.5 Sonnet'),
    (google_id, 'gemini-2.0-flash', 'Gemini 2.0 Flash'),
    (google_id, 'gemini-3-pro-preview', 'Gemini 3 Pro (Preview)'),
    (xai_id, 'grok-2', 'Grok 2'),
    (xai_id, 'grok-3-imagine', 'Grok 3 Imagine')
  ON CONFLICT (slug) DO NOTHING;
end $$;
