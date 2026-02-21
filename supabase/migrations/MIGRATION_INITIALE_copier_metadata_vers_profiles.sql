-- Migration INITIALE : Copier les métadonnées auth vers la table profiles
-- À exécuter UNE SEULE FOIS dans le SQL Editor Supabase

-- Vérifier d'abord votre état actuel
SELECT 
  p.id,
  p.email,
  p.avatar_zoom,
  p.avatar_sidebar_zoom,
  u.raw_user_meta_data->>'avatar_zoom' as meta_zoom,
  u.raw_user_meta_data->>'avatar_sidebar_zoom' as meta_sidebar_zoom
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email = 'alioune.ia77@gmail.com';

-- Si les colonnes SQL sont NULL mais que les metadata contiennent des valeurs, exécutez :

UPDATE profiles p
SET 
  avatar_zoom = COALESCE((u.raw_user_meta_data->>'avatar_zoom')::float8, 1.0),
  avatar_offset_x = COALESCE((u.raw_user_meta_data->>'avatar_offset_x')::float8, 0.0),
  avatar_offset_y = COALESCE((u.raw_user_meta_data->>'avatar_offset_y')::float8, 0.0),
  avatar_sidebar_zoom = COALESCE((u.raw_user_meta_data->>'avatar_sidebar_zoom')::float8, 1.0),
  avatar_sidebar_offset_x = COALESCE((u.raw_user_meta_data->>'avatar_sidebar_offset_x')::float8, 0.0),
  avatar_sidebar_offset_y = COALESCE((u.raw_user_meta_data->>'avatar_sidebar_offset_y')::float8, 0.0)
FROM auth.users u
WHERE p.id = u.id
  AND p.email = 'alioune.ia77@gmail.com';

-- Vérifier que ça a fonctionné
SELECT 
  email,
  avatar_zoom,
  avatar_offset_x,
  avatar_offset_y,
  avatar_sidebar_zoom,
  avatar_sidebar_offset_x,
  avatar_sidebar_offset_y
FROM profiles
WHERE email = 'alioune.ia77@gmail.com';
