---
description: audit un site web et recréer sur l'interface
---

# WORKFLOW AUDIT & RECRÉATION DE SITE WEB → JUNGLE STUDIO

## Objectif
Auditer n'importe quel site web, documenter ses fonctionnalités et son design, puis le recréer comme un onglet dans Jungle Studio en respectant la charte graphique existante.

---

## PHASE 1 : AUDIT VISUEL (1-2h)

### 1.1 Screenshots
- Capturer CHAQUE page, popup, modal, dropdown, empty state, loading state, erreur
- Outil : Chrome DevTools → Ctrl+Shift+P → "Capture full size screenshot"
- Organiser dans /audit/{site}/screenshots/ avec noms clairs
- Capturer aussi la version mobile (responsive)

### 1.2 Inventaire composants UI
Lister chaque composant unique dans ces catégories :
- **Navigation** : sidebar, header, tabs, breadcrumbs, menu contextuel
- **Conteneurs** : cards, modals, drawers, accordéons, tooltips
- **Formulaires** : inputs, selects, switches, sliders, file upload
- **Feedback** : toasts, progress bars, spinners, skeletons, empty states
- **Spécifiques** : éditeur WYSIWYG, galerie templates, preview temps réel

### 1.3 Design tokens — Extraire avec DevTools (Inspecter → Computed)
```
Couleurs : color, background-color, border-color
Typo    : font-family, font-size, font-weight, line-height
Espaces : margin, padding, gap (souvent multiples de 4px/8px)
Radius  : border-radius (4px subtle, 8px cards, 12px modals, 9999px pills)
Ombres  : box-shadow
```
Outils utiles : Wappalyzer (stack), WhatFont (polices), ColorZilla (couleurs)

---

## PHASE 2 : AUDIT TECHNIQUE (2-4h)

### 2.1 Intercepter les appels réseau
1. Chrome DevTools → Network → cocher "Preserve log"
2. Filtrer "Fetch/XHR"
3. Faire chaque action sur le site et observer
4. Pour chaque requête noter : URL, Method, Headers, Payload, Response
5. Exporter en HAR : clic droit → "Save all as HAR with content"

### 2.2 Mapper les endpoints API
Créer un tableau :
| Feature | Method | Endpoint | Body | Response |
|---------|--------|----------|------|----------|
| Login | POST | /api/auth/login | email, password | token |
| List items | GET | /api/v1/items | - | array |
| Create item | POST | /api/v1/items | title, content | item object |
| Generate AI | POST | /api/v1/ai/generate | prompt, style | generated content |
| Export | POST | /api/v1/export | id, format | file url |

### 2.3 Identifier la stack
- View Source → chercher __NEXT_DATA__ (Next.js), ng-version (Angular), data-reactroot (React)
- Network → regarder les domaines tiers (CDN, analytics, paiements)
- Network → filtre WS pour détecter WebSocket/Realtime

### 2.4 Vérifier les APIs disponibles (CRITIQUE)
Chercher dans cet ordre de priorité :
1. **MCP Server** : chercher "https://mcp.{site}.com" — meilleure option, appel direct depuis Claude
2. **API REST publique** : chercher "{site} API documentation" — créer un hook useXxxAPI.ts
3. **Aucune API** : recréer la logique dans une Edge Function avec nos propres LLMs via fusion-run

---

## PHASE 3 : SPÉCIFICATIONS (1-2h)

Rédiger un document avec ces sections AVANT de coder :

### 3.1 Vue d'ensemble
- Objectif de l'onglet
- Features à intégrer (numérotées)
- Features qu'on NE recrée PAS (et pourquoi)
- Source de données : MCP / API / Edge Function

### 3.2 Parcours utilisateur
Lister le flow principal étape par étape :
1. L'utilisateur clique sur l'onglet dans la sidebar
2. Il voit ses créations ou un empty state
3. Il clique "+ Nouveau"
4. Il remplit un prompt ou choisit un template
5. L'IA génère le contenu
6. Il peut éditer
7. Il exporte

### 3.3 Architecture
```
Frontend (React) → Edge Function (fusion-run) → API/MCP externe
                                               → Supabase Storage (exports)
                                               → Supabase DB (métadonnées)
```

### 3.4 Mapping design → Charte Jungle Studio
Adapter les couleurs du site original :
```
Primary du site    → #5C4B40 (brun Jungle)
Background du site → #F8F6F2 (beige Jungle)  
Surface du site    → #EAE1D3/30 (beige léger)
Cards du site      → bg-white/40 backdrop-blur-md border border-[#5C4B40]/5 rounded-2xl
Boutons du site    → bg-[#5C4B40] text-[#F8F6F2] rounded-xl
Labels             → text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/40
Titres             → text-sm font-bold text-[#5C4B40] uppercase tracking-wider
```

### 3.5 Composants à créer
Lister chaque fichier React avec ses props, ses états (loading/empty/error/success) et responsive.

---

## PHASE 4 : IMPLÉMENTATION

### 4.1 Squelette (30 min)
- Créer /components/{feature}/
- Créer le composant principal
- Ajouter le bouton dans Sidebar.tsx
- Ajouter le routing dans page.tsx : `currentView === '{feature}'`
- Afficher un empty state

### 4.2 Connexion API/MCP (1-2h)
- Si MCP : appeler via fusion-run avec le MCP configuré
- Si API REST : créer un hook dédié
- Si rien : créer une Edge Function
- Tester avec un appel simple

### 4.3 UI principale (2-4h)
- Coder chaque composant des spécifications
- Respecter la charte Jungle Studio
- Gérer les 4 états : loading, empty, error, success
- Animations Framer Motion

### 4.4 Features avancées (variable)
- Éditeur, drag & drop, export, collaboration, etc.

### 4.5 Polish (1-2h)
- Test de chaque flow bout en bout
- Responsive mobile
- Erreurs réseau (couper internet)
- Cohérence visuelle avec les autres onglets

---

## CHECKLIST RAPIDE

**Avant de coder :**
☐ Screenshots complets | ☐ Design tokens extraits | ☐ API endpoints mappés
☐ MCP/API identifié | ☐ Spécifications rédigées

**Pendant le dev :**
☐ Onglet dans Sidebar | ☐ Routing dans page.tsx | ☐ API connectée
☐ Charte Jungle respectée | ☐ 4 états gérés | ☐ Responsive

**Avant de livrer :**
☐ 0 erreurs console | ☐ Pas de données en dur | ☐ Clés API dans Supabase Secrets
☐ Pas de base64 dans auth metadata | ☐ Test hors-ligne OK

---

## RÈGLES CRITIQUES
1. **JAMAIS de base64** dans les métadonnées auth (→ HTTP 431)
2. **Toujours expliquer** le pourquoi de chaque action (Alioune apprend)
3. **MCP > API > Edge Function** : toujours préférer la solution la plus directe
4. **Charte Jungle** : adapter le STYLE du site original, garder sa STRUCTURE
5. **Tester avant de valider** : chaque feature doit fonctionner end-to-end