---
trigger: always_on
---

# RÈGLE CRITIQUE : Interdiction du Base64 dans les métadonnées utilisateur Supabase

## Contexte
Le stockage d'images en base64 dans `raw_user_meta_data` de Supabase Auth provoque un gonflement du JWT, qui est embarqué dans les cookies de session. Cela déclenche une erreur HTTP 431 (Request Header Fields Too Large) qui bloque totalement l'authentification.

## Règles obligatoires

### 1. JAMAIS de base64 dans les métadonnées auth
- Ne JAMAIS utiliser `supabase.auth.updateUser({ data: { avatar_url: "data:image/..." } })`
- Ne JAMAIS utiliser `supabase.auth.signUp({ options: { data: { avatar_url: "data:image/..." } } })`
- Ne JAMAIS stocker de `FileReader.readAsDataURL()` dans les métadonnées utilisateur
- Les métadonnées `raw_user_meta_data` doivent rester < 500 caractères au total

### 2. Workflow correct pour les images utilisateur
1. Upload l'image dans **Supabase Storage** (bucket `avatars`)
2. Récupérer l'**URL publique** retournée par Storage
3. Stocker **uniquement l'URL** dans les métadonnées : `{ avatar_url: "https://xxx.supabase.co/storage/v1/..." }`

### 3. Pattern obligatoire pour tout upload d'image liée à un utilisateur
```typescript
// ✅ CORRECT
const { data } = await supabase.storage.from('avatars').upload(path, file)
const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
await supabase.auth.updateUser({ data: { avatar_url: urlData.publicUrl } })

// ❌ INTERDIT
const reader = new FileReader()
reader.readAsDataURL(file)
reader.onload = () => supabase.auth.updateUser({ data: { avatar_url: reader.result } })
```

### 4. Validation avant tout updateUser
Avant chaque appel à `supabase.auth.updateUser()` ou `signUp()` avec des `options.data`, vérifier :
- Aucune valeur ne commence par `data:` (base64)
- Aucune valeur ne dépasse 500 caractères
- Le total de `JSON.stringify(data)` ne dépasse pas 1000 caractères

### 5. Conséquences en cas de non-respect
- Le JWT Supabase gonfle à plusieurs dizaines de Ko
- Les cookies de session dépassent la limite HTTP headers (16 Ko par défaut)
- L'application retourne HTTP 431 et l'utilisateur ne peut plus se connecter
- Le seul fix est de modifier manuellement la base via SQL Editor dans le dashboard Supabase