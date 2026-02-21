# MÉTHODOLOGIE DE DEBUG — RÈGLE GLOBALE

## Principe fondamental
Toujours OBSERVER avant de MODIFIER. Ne jamais supposer. Chaque bug a une cause racine unique — la trouver élimine le symptôme. Ne jamais refactorer, renommer ou restructurer pendant un debug.

## Étape 1 — Lire l'erreur mot par mot
Chaque mot du message d'erreur est un indice. Exemples :
- "Unexpected token 'F'" → un JSON.parse reçoit du texte commençant par F
- "Cannot read property 'x' of undefined" → l'objet parent est undefined
- "net::ERR_ABORTED 404" → le fichier/route n'existe pas
- "401 Unauthorized" → token manquant ou expiré
- "violates row-level security" → policy RLS manquante ou user_id incorrect

## Étape 2 — Localiser la couche
Identifier OÙ vit le bug parmi les 4 couches :
- Frontend (Console F12) → TypeError, Cannot read, useState, composant React
- Réseau (Network F12) → 400/401/403/500, CORS, ERR_NAME_NOT_RESOLVED
- Edge Function (Supabase Logs) → Deno, throw, nom de fonction, console.log
- Base de données (SQL Editor) → RLS, policy, foreign key, column not exist

## Étape 3 — Tracer le flux de données
Reconstruire le chemin complet de la requête :
```
Action utilisateur
  → Fonction frontend (handleSubmit, handleGenerate...)
    → supabase.functions.invoke('nom-fonction', { body })
      → Edge Function parse le body
        → Appel API externe (xAI, Google, OpenAI...)
          → API traite et répond
        → Parse de la réponse API
        → INSERT/UPDATE en base
      → Retour au frontend
    → Mise à jour du state React
  → Re-render UI
```
Identifier à quel point exact du flux l'erreur se produit.

## Étape 4 — Identifier la cause racine
Classer les causes par probabilité (haute → basse). Patterns fréquents :
- Paramètre non supporté par l'API → retirer le paramètre
- String de comparaison incorrecte (model === '' au lieu de 'grok-video') → corriger
- .json() sur réponse non-JSON → lire en .text() d'abord puis JSON.parse avec try/catch
- RLS policy manquante → CREATE POLICY
- user_id pas envoyé depuis le frontend → ajouter dans le body
- Double update state React → un seul point de mise à jour
- Base64 dans metadata auth → stocker dans Storage à la place
- JWT vérifié mais pas envoyé → déployer avec --no-verify-jwt

## Étape 5 — Ajouter des logs stratégiques
Placer les logs AUX POINTS DE RUPTURE, pas partout :
```typescript
// AVANT l'appel API (voir ce qu'on envoie)
console.log('🎬 Request:', JSON.stringify(body, null, 2))

// APRÈS l'appel API (voir la réponse BRUTE)
const rawText = await res.text()
console.log('🔍 Status:', res.status, 'Raw:', rawText.substring(0, 500))

// Protection parsing JSON
let data
try { data = JSON.parse(rawText) } catch { throw new Error('API non-JSON: ' + rawText.substring(0, 200)) }

// APRÈS insertion base
console.log('✅ Saved:', insertData?.id)
```

## Étape 6 — Correction chirurgicale
- Modifier UN SEUL endroit
- Ne pas refactorer
- Ne pas renommer
- Ne pas "améliorer en passant"
- Lister le fichier + la ligne AVANT de modifier

## Étape 7 — Vérifier
1. Redéployer si Edge Function modifiée
2. Tester le MÊME scénario qui a causé le bug
3. Vérifier les logs — plus d'erreur ?
4. Vérifier la base — données insérées ?
5. Vérifier le frontend — UI mise à jour ?
6. Tester un cas adjacent — les autres modes fonctionnent encore ?

## Pattern de protection fetch obligatoire
TOUJOURS protéger les appels fetch vers des APIs externes :
```typescript
const res = await fetch(url, options)
const rawText = await res.text()
let data
try {
  data = JSON.parse(rawText)
} catch {
  console.error('❌ Non-JSON response:', res.status, rawText.substring(0, 300))
  throw new Error(`API error (${res.status}): ${rawText.substring(0, 200)}`)
}
if (!res.ok) {
  console.error('❌ API error:', res.status, data)
  throw new Error(`API ${res.status}: ${JSON.stringify(data)}`)
}
```
Ne JAMAIS faire directement `await res.json()` sur un appel API externe.
