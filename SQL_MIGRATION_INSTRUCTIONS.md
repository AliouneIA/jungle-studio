# Instructions de Migration SQL

J'ai préparé la migration et mis à jour le code de `page.tsx` comme demandé.

## 1. Code Mis à jour (`page.tsx`)
- La colonne `mode` est désormais définie lors de la création d'une conversation ("manus", "supernova", "fusion", "solo").
- Elle est mise à jour dynamiquement lors des échanges.

## 2. Migration SQL (`supabase/migrations/20260215_update_conversations_mode.sql`)
Un fichier de migration a été créé. Cependant, une divergence de version avec votre base de données distante a empêché l'application automatique (`supabase db push` a échoué).

**Action Requise :**
Veuillez exécuter ce SQL manuellement dans votre dashboard Supabase :

```sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode text DEFAULT 'solo';

-- Backfill Manus
UPDATE conversations SET mode = 'manus' WHERE id IN (SELECT distinct conversation_id FROM messages WHERE is_manus = true);

-- Backfill Supernova
UPDATE conversations SET mode = 'supernova' WHERE id IN (SELECT distinct conversation_id FROM fusion_runs WHERE fusion_critiques IS NOT NULL AND jsonb_array_length(fusion_critiques) > 0) AND mode = 'solo';

-- Backfill Fusion
UPDATE conversations SET mode = 'fusion' WHERE id IN (SELECT distinct conversation_id FROM fusion_runs WHERE (fusion_critiques IS NULL OR jsonb_array_length(fusion_critiques) = 0) AND fusion_raw_responses IS NOT NULL AND jsonb_array_length(fusion_raw_responses) > 1) AND mode = 'solo';
```

Une fois exécuté, le système fonctionnera comme prévu.
