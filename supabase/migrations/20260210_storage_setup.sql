-- cspell:disable
-- 1. Table `generated_images` pour les métadonnées
create table if not exists public.generated_images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  prompt text not null,
  model_slug text not null,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.generated_images enable row level security;

-- Policy pour la table (les utilisateurs ne voient que leurs images)
do $$ begin
  create policy "Users manage own images" on public.generated_images for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;


-- 2. Storage Bucket `generated_images` pour les fichiers
insert into storage.buckets (id, name, public)
values ('generated_images', 'generated_images', true)
on conflict (id) do nothing;


-- 3. Storage Policies (accès aux fichiers)
-- Upload authentifié
do $$ begin
  create policy "Authenticated users can upload images" 
  on storage.objects for insert 
  to authenticated 
  with check ( bucket_id = 'generated_images' and auth.role() = 'authenticated' );
exception when duplicate_object then null; end $$;

-- Lecture publique (nécessaire pour afficher dans le chat et la bibliothèque sans token signé complexe)
do $$ begin
  create policy "Public access to view generated images" 
  on storage.objects for select 
  to public 
  using ( bucket_id = 'generated_images' );
exception when duplicate_object then null; end $$;

-- Suppression par le propriétaire (pour la fonction "Supprimer" de la bibliothèque)
do $$ begin
  create policy "Users can delete own images" 
  on storage.objects for delete 
  to authenticated 
  using ( bucket_id = 'generated_images' and owner = auth.uid() );
exception when duplicate_object then null; end $$;
