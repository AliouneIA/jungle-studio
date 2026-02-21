# Règles d'Or du Projet (Mémoire Projet)

## 1. Sécurité Absolue
- **Jamais de clés API en dur.** Toujours utiliser `process.env` ou `import.meta.env`.
- **Interdiction Formelle :** Jamais de `service_role` dans un projet front (même dans `.env`).
- **RLS Obligatoire :** RLS activé sur toutes les tables en production.
- **Environnements Séparés :** DEV Supabase ≠ PROD Supabase (impératif).
- **Modification .env :** Jamais sans validation explicite.
- **Exposition Client :** Uniquement ce qui est public (ex. clé anon publique).
- **.env dans .gitignore :** Vérifier systématiquement.

## 2. Authentification Supabase
- **Source de Vérité :** L'authentification repose entièrement sur Supabase.
- **Initialisation :** Client unique via URL et clé anon du `.env`.
- **Session :** Gérer correctement la persistance (localStorage par défaut avec supabase-js).
- **Vérification :** Toujours vérifier la config avant d'implémenter.

## 3. Données (Supabase est la Vérité)
- **Respect Strict :** Ne jamais inventer de table, colonne ou relation.
- **Évolution :** Toute modif de DB doit être proposée (SQL) et validée AVANT application.
- **Exploration :** Toujours connaître l'état réel de la base avant de coder.

## 4. Workflow & Architecture
- **Exploration Obligatoire :** Ne jamais supposer l'existence de fichiers.
- **Directives :** Consulter ce dossier avant toute fonctionnalité importante. Proposer des mises à jour ici.
- **Lisibilité :** Séparation claire UI / Logique / Data.
- **Pas de Rework :** Stabilité > Simplicité > Évolution.

## 5. Ordre de Travail (Anti-Rework)
1.  **Phase 1 (Backend/Data) :** Explorer, vérifier tables, init client, auth (sans UI).
2.  **Phase 2 (Logique Métier) :** Règles métier, calculs, intégrité des données.
3.  **Phase 3 (Frontend) :** Routing, pages, connexion UI-Logique, Mobile-first.
4.  **Phase 4 (Validation) :** Tests erreurs, sécurité, build.

---
*Ce fichier sert de référence absolue pour tout développement.*
