---
description: Avant de dire "C'est prêt à déployer" ou "Tu peux push", vérifie TOUS ces points.
---

## ✅ ÉTAPE 1 : BUILD & COMPILATION

### 🔨 Test de Build
Exécute mentalement (ou demande de tester) :
```bash
npm run build
```

**Vérifie :**
- ✓ Aucune erreur TypeScript
- ✓ Aucune erreur de compilation Next.js
- ✓ Les warnings sont acceptables (pas de warnings critiques)

---

## ✅ ÉTAPE 2 : RESPONSIVE DESIGN

### 📱 Mobile (`< 768px`)
Vérifie au moins les pages principales :
- ✓ `/` (Homepage)
- ✓ `/chat` (ou route principale de l'app)
- ✓ Pas de débordement horizontal (scroll-x)
- ✓ Les boutons sont cliquables (taille > 44px)

### 💻 Desktop (`> 1024px`)
Vérifie que rien n'a été cassé :
- ✓ Le layout Desktop est intact
- ✓ Les breakpoints `lg:`, `xl:`, `2xl:` fonctionnent
- ✓ Pas de régression visuelle

---

## ✅ ÉTAPE 3 : ASSETS & RESSOURCES

### 🖼️ Fichiers Publics
- ✓ Aucun fichier dans `/public` n'a été supprimé par erreur
- ✓ Les images/modèles 3D se chargent correctement
- ✓ Les icônes/favicon sont présents

### 🔑 Variables d'Environnement
- ✓ Si de nouvelles variables ont été ajoutées, elles sont documentées dans `.env.example`
- ✓ Les clés API sensibles ne sont PAS commitées dans Git

---

## ✅ ÉTAPE 4 : FONCTIONNALITÉS CRITIQUES

### ⚙️ Features Principales
Teste (ou demande de tester) :
- ✓ L'authentification fonctionne (si applicable)
- ✓ Les formulaires soumettent correctement
- ✓ Les animations/transitions sont fluides
- ✓ Pas de bug console critique (erreurs rouges)

---

## ✅ ÉTAPE 5 : VALIDATION FINALE

### 📝 Résumé des Modifications
Avant de valider, liste :
- Les fichiers modifiés
- Les nouvelles fonctionnalités ajoutées
- Les bugs corrigés

**Exemple de formulation :**
> "Modifications prêtes pour déploiement :
> - ✅ Correction du scroll horizontal mobile
> - ✅ Optimisation du Hero Desktop
> - ✅ Build validé sans erreur
> - ✅ Responsive vérifié mobile + desktop
> 
> Tu peux push en toute sécurité."

---

## 🚨 SI UN POINT ÉCHOUE

**NE DIS PAS "C'est prêt"**

À la place :
1. Identifie le point qui pose problème
2. Propose une correction
3. Re-vérifie la checklist après correction
```

---

## 📋 Récapitulatif des 4 Fichiers

| Fichier | Activation | Commandes | Rôle |
|---------|-----------|-----------|------|
| `protection.md` | **Always On** | *(automatique)* | Bouclier permanent anti-casse |
| `debug.md` | Manual | `@debug` `@fix` `@help` | Méthode de débogage structurée |
| `rollback.md` | Manual | `@rollback` `@undo` | Procédure d'annulation sécurisée |
| `deploy.md` | Manual | `@deploy` `@ready` `@push` | Checklist qualité pré-déploiement |

---
