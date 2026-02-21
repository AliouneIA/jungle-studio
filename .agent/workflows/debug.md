---
description: Lorsque l'utilisateur signale un bug, suis STRICTEMENT ces 4 étapes dans l'ordre.   **NE SAUTE AUCUNE ÉTAPE.**
---

## ÉTAPE 1 : ANALYSE & REPRODUCTION (Le Plus Important)

### 🔍 Compréhension
- Lis l'erreur fournie (console, terminal, capture d'écran)
- Explique-la en **français simple** (pas de jargon technique inutile)

### 🎯 Scénario de Reproduction
Avant de chercher la solution, déduis ou **demande explicitement** :

- **Sur quelle page ?** (`/`, `/chat`, autre ?)
- **Sur quelle taille d'écran ?** (Mobile `<768px`, Tablet `768-1024px`, Desktop `>1024px`)
- **Quelle action déclenche le bug ?** (au chargement, au clic, au scroll ?)

**Exemple de formulation :**
> "Pour reproduire ce bug, je dois savoir : apparaît-il uniquement sur mobile ou aussi sur desktop ? Et se produit-il dès le chargement de la page ou après une action spécifique ?"

---

## ÉTAPE 2 : LOCALISATION (Scan)

- Liste **précisément** les fichiers concernés  
  *Exemple :* `components/fusion/Sphere.tsx`, `app/page.tsx`

- Identifie les **lignes suspectes** ou le bloc de code problématique

- Si plusieurs fichiers sont suspects, liste-les par **ordre de priorité**

---

## ÉTAPE 3 : PLAN D'ACTION (Sécurisé)

### 📝 Avant de Coder
Dis-moi **exactement** ce que tu vas faire :

**Exemple :**
> "Je vais modifier le fichier `components/Hero.tsx` ligne 42 pour ajouter une classe `hidden md:block` sur la div du titre, afin de le masquer sur mobile uniquement."

### ⏸️ STOP : Attends mon "GO"
Ne génère **AUCUN code** avant que je valide ton plan.

Si je réponds :
- **"GO"** ou **"OK"** → Passe à l'étape 4
- **"Attends"** ou **"Non"** → Je vais préciser ou corriger ton plan

---

## ÉTAPE 4 : CORRECTION CHIRURGICALE

### ✂️ Code Ciblé Uniquement
- Propose **UNIQUEMENT** le bloc de code corrigé (pas tout le fichier si inutile)
- Indique clairement les lignes à remplacer ou à ajouter

### ✅ Vérifications Post-Correction
- Assure-toi de **ne pas toucher** aux imports existants
- Vérifie que tu **ne casses pas** d'autres fonctionnalités du composant
- Si tu modifies du CSS responsive, vérifie que Desktop reste intact