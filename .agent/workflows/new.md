---
description: Activé via : **@feature** | **@new** | **@create**  Ce workflow guide la création d'une nouvelle fonctionnalité (Page, Composant ou Outil) pour Jungle StudiO.
---

## ÉTAPE 1 : DÉFINITION & VÉRIFICATION (Cadrage)

Avant d'écrire la moindre ligne de code, demande-moi de valider :

### 📋 Informations Requises
1. **Nom de la feature :** (ex: "Historique des chats")
2. **Type :** (Page `/app`, Composant UI, Logique Backend, ou Hook réutilisable ?)
3. **Impact Backend :** Avons-nous besoin d'une nouvelle table Supabase, Edge Function, ou juste du local state ?
4. **Dépendances visuelles :** Nouveaux assets (images, icônes personnalisées) nécessaires ?

### 🔍 Vérification Anti-Conflit
Avant de proposer la structure, vérifie :
- ✓ Qu'un composant/hook de ce nom n'existe pas déjà
- ✓ Que la route `/app/[nom]` n'est pas déjà utilisée
- ✓ Si similaire à existant, propose réutilisation ou extension plutôt que duplication

---

## ÉTAPE 2 : ARCHITECTURE (Plan Structuré)

Propose la structure complète des fichiers à créer.

### 🗂️ Structure Standard (Template)

**Pour un Composant UI Simple :**
```
components/[nom-feature]/
├── MonComposant.tsx        # UI principale
└── index.ts                # Export propre
```

**Pour une Feature Complète (avec données) :**
```
components/[nom-feature]/
├── MonComposant.tsx        # UI principale
└── index.ts

hooks/
└── useMonComposant.ts      # Logique + Supabase

types/
└── [nom-feature].ts        # Types TypeScript (si nécessaire)

app/[nom-feature]/
└── page.tsx                # Route Next.js (si nouvelle page)
```

**Pour une Feature avec Assets :**
```
public/[nom-feature]/
├── icon.svg                # Icônes personnalisées
└── placeholder.webp        # Images placeholder
```

### 📝 Présentation du Plan
Avant de coder, présente :
- Liste des fichiers à créer
- Dépendances externes nécessaires (npm packages)
- Modification de fichiers existants (si intégration dans layout)

**Attends mon "GO" avant de passer à l'étape 3.**

---

## ÉTAPE 3 : DÉVELOPPEMENT (Implémentation)

Une fois le plan validé, génère le code en respectant ces standards :

### 🎨 UI & Styling
- **Framework CSS :** Utilise exclusivement **Tailwind CSS** (pas de CSS inline ou fichiers .css séparés)
- **Animations :** Utilise **Framer Motion** pour les transitions (fadeIn, slide, etc.)
- **Icônes :** Priorité à **lucide-react** (cohérence avec l'existant)

### 🔧 Logique & Données
- **Séparation des responsabilités :** Passe TOUJOURS par un Hook pour appeler Supabase (pas d'appel direct dans l'UI)
- **Gestion d'état :** Utilise `useState` pour local, `useContext` si global nécessaire
- **Types :** Définis les interfaces TypeScript dans `types/[nom-feature].ts`

### 📱 Responsive
Vérifie SYSTÉMATIQUEMENT :
- ✓ **Mobile (`< 768px`)** : Layout en colonne, boutons pleine largeur
- ✓ **Tablet (`768-1024px`)** : Layout adaptatif
- ✓ **Desktop (`> 1024px`)** : Layout optimisé (grilles, sidebars)

**Checklist Responsive Obligatoire :**
```tsx
// ❌ INTERDIT


// ✅ CORRECT

```

### 🧩 Composants Réutilisables
Si tu crées des éléments réutilisables (boutons, cards) :
- Rends-les génériques (props customisables)
- Exporte-les proprement via `index.ts`

---

## ÉTAPE 4 : INTÉGRATION & VALIDATION

### 🔗 Intégration
1. **Ajout dans la page parente** (si applicable)
2. **Import dans le layout** (si composant global comme Header/Footer)
3. **Ajout de la route dans navigation** (si nouvelle page)

### ✅ Validation Technique
Avant de dire "Feature terminée", vérifie :

**Build & Lint :**
```bash
npm run lint          # Pas d'erreurs TypeScript/ESLint
npm run build         # Build Next.js réussi
```

**Responsive :**
- ✓ Ouvre DevTools responsive (F12)
- ✓ Teste sur iPhone SE (375px), iPad (768px), Desktop (1920px)
- ✓ Pas de scroll horizontal

**Fonctionnel :**
- ✓ Les données se chargent correctement (si Supabase)
- ✓ Les animations fonctionnent
- ✓ Pas d'erreur console

---

## 📋 CHECKLIST FINALE

Avant de clore le workflow, confirme :

- [ ] Tous les fichiers sont créés dans la bonne structure
- [ ] Le composant est responsive (mobile + desktop)
- [ ] Le code build sans erreur (`npm run build`)
- [ ] Les types TypeScript sont corrects
- [ ] Pas d'import inutilisé ou de console.log oublié
- [ ] La feature est intégrée dans la navigation (si page)

**Si tout est ✅ → Feature prête à commit !**
```

---

## 🎯 Recommandation Finale

### **Plan d'Implémentation Progressif**
```
PHASE 1 (Maintenant) :
✅ protection.md       ← PRIORITÉ 1
✅ workflow-debug.md   ← PRIORITÉ 2

↓ Teste pendant 1 semaine ↓

PHASE 2 (Si utile) :
✅ workflow-rollback.md
✅ workflow-deploy.md

↓ Si tu crées beaucoup de features ↓

PHASE 3 (Optionnel) :
✅ workflow-feature.md   ← Ajoute quand tu sens le besoin
```

---

## 📊 Résumé en 1 Image
```
┌────────────────────────────────────────┐
│  NÉCESSAIRE                            │
│  protection.md                         │
│  workflow-debug.md                     │
└────────────────────────────────────────┘
              ▼
┌────────────────────────────────────────┐
│  UTILE                                 │
│  workflow-rollback.md                  │
│  workflow-deploy.md                    │
└────────────────────────────────────────┘
              ▼
┌────────────────────────────────────────┐
│  CONFORT (si développement intensif)   │
│  workflow-feature.md                   │
└────────────────────────────────────────┘