# 🔧 Comment réparer les messages manquants

## Le problème

Les **anciennes conversations** n'ont pas leurs messages dans la table `messages`. Les réponses sont dans `fusion_syntheses` et les questions dans `fusion_runs.prompt_original`.

## Solution rapide (5 minutes)

### Étape 1 : Ouvrir le SQL Editor

1. Allez sur https://supabase.com/dashboard/project/xrhcaskiudkszbrhuisu/sql
2. Connectez-vous à votre compte Supabase

### Étape 2 : Diagnostic (optionnel mais recommandé)

Copiez-collez le contenu de `DIAGNOSTIC_COMPLET.sql` dans l'éditeur et cliquez sur **Run**.

Vous verrez :
- ✅ Nombre de conversations vides
- ✅ Nombre de conversations avec seulement la question user
- ✅ Nombre de réponses à migrer

### Étape 3 : Migration complète

Copiez-collez le contenu de `MIGRATION_COMPLETE_messages.sql` dans l'éditeur et cliquez sur **Run**.

Cela va :
1. ✅ Créer les messages **user** manquants depuis `fusion_runs.prompt_original`
2. ✅ Créer les messages **assistant** manquants depuis `fusion_syntheses.final_content`
3. ✅ Afficher les statistiques finales

### Étape 4 : Vérifier

Rafraîchissez votre application et cliquez sur une ancienne conversation depuis l'onglet **Recherche**.

Les messages devraient maintenant s'afficher ! 🎉

## Alternative : Migration depuis le navigateur

Si vous préférez exécuter depuis la console du navigateur :

```javascript
await window.migrateOldMessages()
```

Puis vérifiez le résultat :

```javascript
await window.runDiagnostics()
```

## En cas de problème

Si ça ne marche toujours pas :

1. Ouvrez la console (F12)
2. Exécutez `await window.runDiagnostics()`
3. Envoyez-moi la sortie pour que je puisse voir ce qui ne va pas

## Notes importantes

- ✅ Cette migration est **sans risque** : elle n'insère que les messages manquants
- ✅ Elle ne modifie **aucune donnée existante**
- ✅ Elle peut être exécutée **plusieurs fois** sans problème (idempotente)
