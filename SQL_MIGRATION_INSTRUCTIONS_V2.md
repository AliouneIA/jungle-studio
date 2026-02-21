# Instructions de Migration SQL (CORRIGÉ V2)

Une erreur s'est glissée dans le script précédent car `fusion_runs` ne contient pas directement les critiques ni les réponses brutes, mais utilise des tables de relation.

## 📝 MIGRATION CORRIGÉE

Exécutez ce script **exactement** dans votre éditeur SQL Supabase pour corriger l'erreur `column "fusion_critiques" does not exist` et effectuer la migration correctement.

```sql
-- 1. Ajouter la colonne si elle n'existe pas
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode text DEFAULT 'solo';

-- 2. Backfill Manus (Basé sur les messages Manus)
UPDATE conversations 
SET mode = 'manus' 
WHERE id IN (
  SELECT distinct conversation_id 
  FROM messages 
  WHERE is_manus = true
);

-- 3. Backfill Supernova 
-- (Basé sur l'existence de critiques liées dans la table fusion_critiques)
UPDATE conversations
SET mode = 'supernova'
WHERE id IN (
    SELECT distinct fr.conversation_id 
    FROM fusion_runs fr
    INNER JOIN fusion_critiques fc ON fc.run_id = fr.id
) AND mode = 'solo';

-- 4. Backfill Fusion
-- (Basé sur l'existence de plusieurs réponses brutes SANS critiques)
UPDATE conversations
SET mode = 'fusion'
WHERE id IN (
    SELECT distinct fr.conversation_id 
    FROM fusion_runs fr
    INNER JOIN fusion_raw_responses frr ON frr.run_id = fr.id
    WHERE NOT EXISTS (
        SELECT 1 FROM fusion_critiques fc WHERE fc.run_id = fr.id
    )
    GROUP BY fr.conversation_id, fr.id
    HAVING count(frr.id) > 1
) AND mode = 'solo';
```

Une fois exécuté, toutes vos conversations historiques seront correctement étiquetées.
