-- Script de diagnostic et nettoyage des anciennes métadonnées avatar

-- 1. Vérifier les colonnes existantes dans la table profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles';

-- 2. Voir les données actuelles de votre profil
-- Remplacez 'VOTRE_USER_ID' par votre ID utilisateur (visible dans auth.users)
-- SELECT * FROM profiles WHERE id = 'VOTRE_USER_ID';

-- 3. Forcer la synchronisation : Copier les données des métadonnées auth vers profiles (si besoin)
-- UPDATE profiles p
-- SET 
--   avatar_zoom = (u.raw_user_meta_data->>'avatar_zoom')::float8,
--   avatar_offset_x = (u.raw_user_meta_data->>'avatar_offset_x')::float8,
--   avatar_offset_y = (u.raw_user_meta_data->>'avatar_offset_y')::float8,
--   avatar_sidebar_zoom = COALESCE((u.raw_user_meta_data->>'avatar_sidebar_zoom')::float8, 1.0),
--   avatar_sidebar_offset_x = COALESCE((u.raw_user_meta_data->>'avatar_sidebar_offset_x')::float8, 0.0),
--   avatar_sidebar_offset_y = COALESCE((u.raw_user_meta_data->>'avatar_sidebar_offset_y')::float8, 0.0)
-- FROM auth.users u
-- WHERE p.id = u.id;

-- 4. Nettoyer les métadonnées auth pour éviter les conflits (OPTIONNEL - À utiliser prudemment)
-- Cette requête supprime les champs de zoom/offset des métadonnées auth.
-- La table profiles devient la seule source de vérité.
-- 
-- ⚠️ ATTENTION: Cette opération modifie les métadonnées auth. 
-- Assurez-vous d'avoir une sauvegarde ou testez d'abord sur un utilisateur test.
--
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data 
--   - 'avatar_zoom' 
--   - 'avatar_offset_x' 
--   - 'avatar_offset_y'
--   - 'avatar_sidebar_zoom'
--   - 'avatar_sidebar_offset_x'
--   - 'avatar_sidebar_offset_y'
-- WHERE id = 'VOTRE_USER_ID';
