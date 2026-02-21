-- Ajout des politiques de sécurité manquantes pour la sauvegarde des fusions
-- Autorise l'insertion si le run associé appartient à l'utilisateur

-- 1. Réponses Brutes
CREATE POLICY "Users can insert own raw responses" ON public.fusion_raw_responses 
FOR INSERT WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.fusion_runs WHERE id = run_id)
);

-- 2. Critiques (Supernova)
CREATE POLICY "Users can insert own critiques" ON public.fusion_critiques 
FOR INSERT WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.fusion_runs WHERE id = run_id)
);

-- 3. Synthèses finalisées
CREATE POLICY "Users can insert own syntheses" ON public.fusion_syntheses 
FOR INSERT WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.fusion_runs WHERE id = run_id)
);
