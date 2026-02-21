-- Migration: Project Management
-- Adds a projects table and links conversations to projects.

-- 1. Create Projects Table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  title text not null,
  description text,
  icon text, -- Slug of the lucide icon or Emoji
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Add Project ID to Conversations
alter table public.conversations add column if not exists project_id uuid references public.projects(id) on delete set null;

-- 3. RLS for Projects
alter table public.projects enable row level security;

create policy "Users manage own projects" on public.projects
  for all using (auth.uid() = user_id);

-- 4. Set triggers for updated_at
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- 5. Helpful Indexes
create index if not exists conversations_project_id_idx on public.conversations(project_id);
create index if not exists projects_user_id_idx on public.projects(user_id);
