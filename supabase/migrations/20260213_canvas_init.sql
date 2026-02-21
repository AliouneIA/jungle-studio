-- cspell:disable
-- Migration pour l'outil Canevas (Canvas)

-- 1. Table des artefacts (documents/code)
create table if not exists public.canvas_artifacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'Document sans titre',
  kind text not null check (kind in ('doc', 'code')),
  language text, -- ex: 'javascript', 'markdown', 'typescript'
  content text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Table des versions (historique des modifications)
create table if not exists public.canvas_versions (
  id uuid default gen_random_uuid() primary key,
  artifact_id uuid references public.canvas_artifacts(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  summary text,
  operations jsonb, -- contrat patch [{op, start, end, text}]
  content_snapshot text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Sécurité (RLS)
alter table public.canvas_artifacts enable row level security;
alter table public.canvas_versions enable row level security;

-- Policies pour canvas_artifacts
create policy "Users manage own artifacts" 
on public.canvas_artifacts for all 
using (auth.uid() = user_id);

-- Policies pour canvas_versions
create policy "Users manage own versions" 
on public.canvas_versions for all 
using (auth.uid() = user_id);

-- 4. Indexation
create index if not exists idx_canvas_artifacts_user on public.canvas_artifacts(user_id);
create index if not exists idx_canvas_artifacts_project on public.canvas_artifacts(project_id);
create index if not exists idx_canvas_versions_artifact on public.canvas_versions(artifact_id);

-- 5. Trigger pour updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.canvas_artifacts
  for each row
  execute function public.handle_updated_at();
