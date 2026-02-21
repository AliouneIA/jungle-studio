-- Migration pour autoriser la lecture des archives de réflexion par l'utilisateur propriétaire
-- Note : Ces politiques sont essentielles pour l'affichage de l'historique dans le ReflectionPanel

-- 1. Autoriser la lecture des runs par l'utilisateur
CREATE POLICY "Users can view own fusion runs" ON public.fusion_runs
FOR SELECT USING (auth.uid() = user_id);

-- 2. Autoriser la lecture des réponses brutes associées aux runs de l'utilisateur
CREATE POLICY "Users can view own raw responses" ON public.fusion_raw_responses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.fusion_runs 
    WHERE public.fusion_runs.id = public.fusion_raw_responses.run_id 
    AND public.fusion_runs.user_id = auth.uid()
  )
);

-- 3. Autoriser la lecture des critiques (Supernova)
CREATE POLICY "Users can view own critiques" ON public.fusion_critiques
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.fusion_runs 
    WHERE public.fusion_runs.id = public.fusion_critiques.run_id 
    AND public.fusion_runs.user_id = auth.uid()
  )
);

-- 4. Autoriser la lecture des synthèses
CREATE POLICY "Users can view own syntheses" ON public.fusion_syntheses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.fusion_runs 
    WHERE public.fusion_runs.id = public.fusion_syntheses.run_id 
    AND public.fusion_runs.user_id = auth.uid()
  )
);
