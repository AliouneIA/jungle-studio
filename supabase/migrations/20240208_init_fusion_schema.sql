-- 1. SETUP & EXTENSIONS
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
security definer
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- 2. PROFILS UTILISATEURS (Lié à Auth)
create table public.profiles (
  id uuid references auth.users(id) not null primary key,
  email text,
  username text,
  credits int default 100,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.profiles enable row level security;
create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id);

-- Trigger création profil auto
create or replace function public.handle_new_user() returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- 3. IA CONFIGURATION (Providers & Models)
create table public.providers (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique, -- 'openai', 'google', 'anthropic', 'xai'
  name text not null
);
alter table public.providers enable row level security;
create policy "Read only providers" on public.providers for select using (true);

create table public.models (
  id uuid default gen_random_uuid() primary key,
  provider_id uuid references public.providers(id) not null,
  slug text not null unique, -- 'gpt-4o'
  name text not null,
  is_active boolean default true
);
alter table public.models enable row level security;
create policy "Read only models" on public.models for select using (true);

-- 4. CHAT SYSTEM
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.conversations enable row level security;
create policy "Users manage own conversations" on public.conversations for all using (auth.uid() = user_id);

create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text,
  is_fusion_result boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.messages enable row level security;
create policy "Users manage own messages" on public.messages for all using (auth.uid() = user_id);

-- 5. MOTEUR DE FUSION (Jungle Engine)
create table public.fusion_runs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  conversation_id uuid references public.conversations(id) not null,
  prompt_original text not null,
  master_model_slug text not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.fusion_runs enable row level security;
create policy "Users manage own runs" on public.fusion_runs for all using (auth.uid() = user_id);

create table public.fusion_raw_responses (
  id uuid default gen_random_uuid() primary key,
  run_id uuid references public.fusion_runs(id) on delete cascade not null,
  model_slug text not null,
  content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.fusion_raw_responses enable row level security;
create policy "Users see own raw responses" on public.fusion_raw_responses for select using (auth.uid() = (select user_id from public.fusion_runs where id = run_id));

create table public.fusion_critiques (
  id uuid default gen_random_uuid() primary key,
  run_id uuid references public.fusion_runs(id) on delete cascade not null,
  critic_model_slug text not null,
  target_model_slug text not null,
  critique_content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.fusion_critiques enable row level security;
create policy "Users see own critiques" on public.fusion_critiques for select using (auth.uid() = (select user_id from public.fusion_runs where id = run_id));

create table public.fusion_syntheses (
  id uuid default gen_random_uuid() primary key,
  run_id uuid references public.fusion_runs(id) on delete cascade not null,
  master_model_slug text not null,
  final_content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.fusion_syntheses enable row level security;
create policy "Users see own syntheses" on public.fusion_syntheses for select using (auth.uid() = (select user_id from public.fusion_runs where id = run_id));

-- 6. IMAGES
create table public.generated_images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  prompt text not null,
  model_slug text not null,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.generated_images enable row level security;
create policy "Users manage own images" on public.generated_images for all using (auth.uid() = user_id);

-- 7. SEED DATA (Population initiale)
do $$
declare
  openai_id uuid;
  google_id uuid;
  anthropic_id uuid;
  xai_id uuid;
begin
  -- Providers
  insert into public.providers (slug, name) values 
    ('openai', 'OpenAI'), ('google', 'Google'), ('anthropic', 'Anthropic'), ('xai', 'xAI (Grok)')
  on conflict (slug) do nothing;
  
  select id into openai_id from public.providers where slug = 'openai';
  select id into google_id from public.providers where slug = 'google';
  select id into anthropic_id from public.providers where slug = 'anthropic';
  select id into xai_id from public.providers where slug = 'xai';

  -- Models
  insert into public.models (provider_id, slug, name) values
    (openai_id, 'gpt-4o', 'GPT-4 Omni'),
    (anthropic_id, 'claude-3-5-sonnet', 'Claude 3.5 Sonnet'),
    (google_id, 'gemini-1.5-pro', 'Gemini 1.5 Pro'),
    (xai_id, 'grok-beta', 'Grok Beta')
  on conflict (slug) do nothing;
end $$;
