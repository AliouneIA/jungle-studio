-- cspell:disable
-- Migration pour la gestion des pièces jointes dans le chat

-- 1. Storage Bucket `chat_attachments`
insert into storage.buckets (id, name, public)
values ('chat_attachments', 'chat_attachments', true)
on conflict (id) do nothing;

-- 2. Storage Policies
-- Upload authentifié
do $$ begin
  create policy "Authenticated users can upload attachments" 
  on storage.objects for insert 
  to authenticated 
  with check ( bucket_id = 'chat_attachments' and auth.role() = 'authenticated' );
exception when duplicate_object then null; end $$;

-- Lecture publique
do $$ begin
  create policy "Public access to view attachments" 
  on storage.objects for select 
  to public 
  using ( bucket_id = 'chat_attachments' );
exception when duplicate_object then null; end $$;

-- Suppression par le propriétaire
do $$ begin
  create policy "Users can delete own attachments" 
  on storage.objects for delete 
  to authenticated 
  using ( bucket_id = 'chat_attachments' and owner = auth.uid() );
exception when duplicate_object then null; end $$;
