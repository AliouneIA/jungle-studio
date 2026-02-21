---
description: Si une modification a cassé le site ou introduit un bug critique.
---

## ÉTAPE 1 : DIAGNOSTIC RAPIDE

### 🔴 Analyse de l'Impact
- Lis l'erreur actuelle
- Identifie **quand** le bug est apparu (après quelle modification ?)

### 📂 Liste des Fichiers Modifiés
- Recense **tous les fichiers** que tu as touchés dans les **2 dernières réponses**
- Classe-les par criticité :
  - 🔴 Critique (layout, config globale)
  - 🟠 Important (composant principal)
  - 🟢 Mineur (style local)

---

## ÉTAPE 2 : PROPOSITION DE RESTAURATION

### 🕐 Identification de l'État "Avant"
- Si Git est utilisé : Propose la commande  
```bash
  git restore 
```
  ou
```bash
  git checkout HEAD~1 -- 
```

- Si pas de Git : Indique les blocs de code à restaurer manuellement

### 📋 Liste des Actions
Présente un plan clair :

**Exemple :**
> "Pour annuler, je propose de :
> 1. Restaurer `components/Hero.tsx` à sa version précédente
> 2. Garder les modifications de `app/page.tsx` qui fonctionnent
> 3. Tester ensuite si le bug disparaît"

---

## ÉTAPE 3 : ATTENTE VALIDATION

### ⏸️ NE PAS EXÉCUTER AUTOMATIQUEMENT
- **N'exécute AUCUNE commande Git** sans mon "GO"
- Attends ma confirmation explicite

### ✅ Si Validé
- Fournis les commandes exactes à exécuter
- Ou fournis le code restauré à copier-coller

---

## ÉTAPE 4 : VÉRIFICATION POST-ROLLBACK

Après restauration :
- Vérifie que le site rebuild sans erreur
- Confirme que le bug initial a disparu
- Identifie **pourquoi** la modification précédente a échoué (pour éviter de répéter)