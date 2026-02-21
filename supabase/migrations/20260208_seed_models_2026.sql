-- Mise à jour des modèles (Seed Data - Février 2026)
do $$
declare
  openai_id uuid;
  google_id uuid;
  anthropic_id uuid;
  xai_id uuid;
begin
  -- Récupération des IDs Providers existants
  select id into openai_id from public.providers where slug = 'openai';
  select id into google_id from public.providers where slug = 'google';
  select id into anthropic_id from public.providers where slug = 'anthropic';
  select id into xai_id from public.providers where slug = 'xai';

  -- Insertion des nouveaux modèles 2026
  insert into public.models (provider_id, slug, name, is_active) values
    (openai_id, 'gpt-5.2', 'GPT-5.2 (OpenAI)', true),
    (openai_id, 'o3-pro', 'OpenAI o3-pro', true),
    (anthropic_id, 'claude-opus-4-6', 'Claude Opus 4.6', true),
    (google_id, 'gemini-3-pro', 'Gemini 3 Pro', true),
    (google_id, 'nano-banana-pro', 'Nano Banana Pro', true),
    (xai_id, 'grok-4-1', 'Grok 4.1', true)
  on conflict (slug) do update 
  set name = excluded.name, is_active = true;
end $$;
