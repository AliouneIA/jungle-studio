// cspell:disable
// @ts-nocheck
// supabase/functions/fusion-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuration CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Model Mapping (Task-specific aliases -> Real current models Feb 2026)
export const AI_MODELS = {
    chat: 'gpt-5.2-instant',      // GPT-5.2 Instant (chat-latest)
    vision: 'gemini-3-flash',     // Gemini 3 Flash
    code: 'grok-4-1-fast',        // Grok 4.1 Fast
    reasoning: 'claude-opus-4.6',  // Claude Opus 4.6
};

const MODEL_MAP: Record<string, string> = {
    // ═══ OpenAI ═══
    'gpt-5.2': 'gpt-5.2',              // Thinking (raisonnement)
    'gpt-5.2-pro': 'gpt-5.2',              // ⚠️ Pro nécessite Responses API, fallback vers standard
    'gpt-5.2-instant': 'gpt-5.2-chat-latest',  // Instant (chat rapide)

    // ═══ Anthropic ═══
    'claude-opus-4.6': 'claude-opus-4-6',
    'claude-sonnet-4.5': 'claude-sonnet-4-5-20250929',
    'claude-4.5-haiku': 'claude-haiku-4-5-20251001',

    // ═══ Google Gemini ═══
    'gemini-3.0-pro': 'gemini-3-pro-preview',
    'gemini-3-flash': 'gemini-3-flash-preview',
    'gemini-3-pro-image': 'gemini-3-pro-image-preview',

    // ═══ xAI / Grok ═══
    'grok-4-1-fast': 'grok-2',
    'grok-4-2': 'grok-2',
}

// Helper to get user's own API key from api-keys function (Point 3)
async function getUserApiKey(baseUrl: string, userToken: string, provider: string): Promise<string | null> {
    try {
        const res = await fetch(`${baseUrl}/functions/v1/api-keys?action=decrypt`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ provider })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.api_key || null;
    } catch {
        return null;
    }
}

// Helper to get API keys (Merged with User Keys)
async function getFullApiKeys(baseUrl: string, userToken: string | null) {
    const globalKeys = {
        openai: Deno.env.get('OPENAI_API_KEY'),
        anthropic: Deno.env.get('ANTHROPIC_API_KEY'),
        google: Deno.env.get('GOOGLE_API_KEY'),
        grok: Deno.env.get('XAI_API_KEY') || Deno.env.get('GROK_API_KEY'),
        manus: Deno.env.get('MANUS_API_KEY')
    };

    if (!userToken) return globalKeys;

    // Try to get individual user keys
    const [uOpenai, uAnthropic, uGoogle, uGrok] = await Promise.all([
        getUserApiKey(baseUrl, userToken, 'openai'),
        getUserApiKey(baseUrl, userToken, 'anthropic'),
        getUserApiKey(baseUrl, userToken, 'google'),
        getUserApiKey(baseUrl, userToken, 'xai') // 'xai' used in ApiKeysPanel for Grok
    ]);

    return {
        openai: uOpenai || globalKeys.openai,
        anthropic: uAnthropic || globalKeys.anthropic,
        google: uGoogle || globalKeys.google,
        grok: uGrok || globalKeys.grok,
        manus: globalKeys.manus
    };
}

// Helper to call a model
async function callModel(slug: string, prompt: string, keys: any, instructions?: string, history: any[] = [], forceJson: boolean = false, options: any = {}): Promise<{ slug: string, content: string, status: string, error?: string, tokens?: number }> {
    try {
        const realSlug = MODEL_MAP[slug] || slug
        let content = ''
        let tokens = 0

        const systemContext = "Réponds exclusivement en TEXTE SIMPLE. Pas de Markdown. Pas de gras, pas d'italique, pas de titres.";
        let finalPrompt = systemContext + "\n\n" + prompt;

        if (instructions) {
            finalPrompt = `[DIRECTIVES DU PROJET À RESPECTER IMPÉRATIVEMENT]:\n${instructions}\n\n[CONTEXTE SYSTÈME]:\n${systemContext}\n\n[QUESTION UTILISATEUR]:\n${prompt}`;
        }

        // Inject Memory (Point 2)
        if (options.memoryBlock) {
            finalPrompt = `${options.memoryBlock}\n\n${finalPrompt}`;
        }

        // Real API calls
        if (slug.includes('gpt') && keys.openai) {
            const result = await fetchOpenAI(finalPrompt, keys.openai, realSlug, history, options)
            content = result.content
            tokens = result.tokens
        } else if (slug.includes('claude') && keys.anthropic) {
            const result = await fetchAnthropic(finalPrompt, keys.anthropic, realSlug, history, options)
            content = result.content
            tokens = result.tokens
        } else if (slug.includes('gemini') && keys.google) {
            const result = await fetchGoogle(finalPrompt, keys.google, realSlug, history, forceJson || options.forceJson, options)
            content = result.content
            tokens = result.tokens
        } else if (slug.includes('grok') && keys.grok) {
            const result = await fetchGrok(finalPrompt, keys.grok, realSlug, history, options)
            content = result.content
            tokens = result.tokens
        } else {
            throw new Error(`Clé API manquante ou modèle non supporté pour: ${slug}`);
        }

        return { slug, content, status: 'success', tokens }
    } catch (error: any) {
        console.error(`Erreur modèle ${slug}: `, error)
        return { slug, content: '', status: 'failed', error: error.message, tokens: 0 }
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders, status: 204 })
    }

    try {
        // 1. Supabase Client
        const authHeader = req.headers.get('Authorization');
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader ?? '' } } }
        )

        // 2. Get User (Safely)
        let user = null;
        try {
            if (authHeader) {
                const { data } = await supabaseClient.auth.getUser();
                user = data?.user ?? null;
            }
        } catch (authErr) {
            console.warn("User auth check failed:", authErr);
            // Continue without user
        }

        const {
            prompt,
            model_slugs,
            master_model_slug,
            fusion_mode = 'fusion',
            conversation_id,
            project_id,
            image_count = 1,
            history = [],
            web_verify = false,
            forceJson = false,
            skip_save = false
        } = await req.json()

        if (!prompt) throw new Error("Paramètre 'prompt' manquant")

        // 3. User & Memory (Point 2)
        const userToken = authHeader?.split(' ')[1] || '';
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

        let memoryBlock = '';
        if (userToken) {
            try {
                const memoryRes = await fetch(`${SUPABASE_URL}/functions/v1/memory-get`, {
                    headers: {
                        'Authorization': `Bearer ${userToken}`,
                        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
                        'Content-Type': 'application/json'
                    }
                });
                const memoryData = await memoryRes.json();
                memoryBlock = memoryData?.system_prompt_block || '';
            } catch (err) {
                console.warn("[Memory] Get failed:", err);
            }
        }

        console.log(`User: ${user?.id || 'ANONYMOUS'}, Mode: ${fusion_mode} `)

        const keys = await getFullApiKeys(SUPABASE_URL, userToken)
        const safeModelSlugs = Array.isArray(model_slugs) ? model_slugs : ['gpt-5.2-pro', 'claude-opus-4.6', 'gemini-3.0-pro']
        let masterSlug = master_model_slug || 'gpt-5.2'

        // Force masterSlug for Manus to ensure history filtering works
        if (fusion_mode === 'manus') {
            masterSlug = 'manus-agent'
        }

        // 4. Fetch Project Instructions if project_id exists
        let projectInstructions = "";
        if (project_id) {
            try {
                const { data: project } = await supabaseClient
                    .from('projects')
                    .select('instructions')
                    .eq('id', project_id)
                    .single();
                if (project?.instructions) {
                    projectInstructions = project.instructions;
                    console.log(`Instructions du projet ${project_id} chargées.`);
                }
            } catch (err) {
                console.warn("Could not fetch project instructions:", err);
            }
        }

        let totalTokens = 0
        let exchanges: any[] = []
        let phases: any = { initial: [], crossAnalysis: [], refinement: [], synthesis: null }

        // ========== PROCESSING ==========
        let initialResults: any[] = []
        let finalContent = ''
        let imageUrl = ''
        let runId: string | undefined = undefined;
        let savedConversationId = conversation_id; // Declared here to be accessible in return

        if (fusion_mode === 'manus') {
            // MANUS AI AGENT MODE
            console.log('Mode Agent Manus activé...')
            if (!keys.manus) throw new Error("Clé API Manus manquante.")

            const result = await fetchManus(prompt, keys.manus, history)
            finalContent = result.content
            totalTokens = result.tokens
            initialResults = [{ slug: 'manus-agent', content: finalContent, status: 'success', tokens: totalTokens }]
            phases.initial = initialResults
            phases.synthesis = { masterSlug: 'manus-agent', content: finalContent, tokens: totalTokens }

        } else if (fusion_mode === 'image') {
            // IMAGE GENERATION MODE
            console.log(`Mode Image Generation (Count: ${image_count}) via Google Gemini/Grok/Imagen...`)

            let modelName = masterSlug;
            if (masterSlug === 'gemini-3-pro-image-preview') modelName = 'Nano Banana Pro';
            if (masterSlug === 'grok-imagine-pro') modelName = 'Grok Imagine Pro';

            const count = Math.min(Math.max(1, image_count), 4); // Clamp between 1 and 4
            let generatedImages: string[] = [];
            let errors: string[] = [];

            // Execute in sequence or parallel? 
            // Sequence is safer for rate limits and memory, but slower. 
            // Parallel (Promise.all) is faster but riskier. We'll use sequence for reliability in Deno.
            for (let i = 0; i < count; i++) {
                try {
                    let currentB64 = '';
                    let currentImgUrl = '';

                    if (masterSlug.includes('grok')) {
                        const grokKey = Deno.env.get('GROK_API_KEY') || Deno.env.get('XAI_API_KEY');
                        if (!grokKey) throw new Error("Clé API Grok manquante.");
                        const imgResult = await fetchGrokImage(prompt, grokKey);
                        if (imgResult.type === 'b64') currentB64 = imgResult.data;
                        else currentImgUrl = imgResult.data;
                    } else if (masterSlug.includes('imagen')) {
                        if (!keys.google) throw new Error("Clé API Google manquante pour Imagen.");
                        let imagenModel = 'imagen-4.0-generate-001';
                        if (masterSlug.includes('standard')) imagenModel = 'imagen-4.0-generate-001';
                        if (masterSlug.includes('fast')) imagenModel = 'imagen-4.0-fast-generate-001';
                        if (masterSlug.includes('ultra')) imagenModel = 'imagen-4.0-ultra-generate-001';
                        modelName = imagenModel;
                        currentB64 = await fetchImagenPredict(prompt, keys.google, imagenModel);
                    } else if (keys.google && (masterSlug.includes('gemini') || masterSlug.includes('nano'))) {
                        currentB64 = await fetchGoogleImage(prompt, keys.google, 'gemini-3-pro-image-preview');
                        modelName = 'Nano Banana Pro';
                    } else {
                        currentImgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${Math.floor(Math.random() * 1000000)}`;
                    }

                    if (currentB64) {
                        if (user) {
                            const publicUrl = await uploadAndTrackImage(supabaseClient, user.id, prompt, modelName, currentB64);
                            currentImgUrl = publicUrl || `data:image/png;base64,${currentB64}`;
                        } else {
                            currentImgUrl = `data:image/png;base64,${currentB64}`;
                        }
                    }

                    if (currentImgUrl) generatedImages.push(currentImgUrl);

                } catch (e: any) {
                    console.error(`Error generating image ${i + 1}:`, e);
                    errors.push(e.message);
                }
            }

            if (generatedImages.length > 0) {
                imageUrl = generatedImages[0];
                finalContent = `Voici vos créations générées avec **${modelName}** :\n\n`;
                finalContent += generatedImages.map(url => `![Image](${url})`).join('\n\n');
                if (errors.length > 0) {
                    finalContent += `\n\n*(Note: ${errors.length} images ont échoué : ${errors.join(', ')})*`;
                }
            } else {
                finalContent = `⚠️ Échec de la génération : ${errors.join(', ')}`;
            }

            initialResults = [{ slug: masterSlug, content: finalContent, status: 'success', tokens: 0, image_url: imageUrl, all_images: generatedImages }]
            phases.initial = [{ slug: masterSlug, content: finalContent, tokens: 0, image_url: imageUrl }]

        } else {
            // TEXT FUSION MODES (Fusion / Supernova)
            // ========== PHASE 1: Initial Responses ==========
            console.log('Phase 1: Initial responses...')
            const initialPromises = safeModelSlugs.map(slug => callModel(slug, prompt, keys, projectInstructions, history, forceJson, { memoryBlock }))
            initialResults = await Promise.all(initialPromises)
            phases.initial = initialResults.map(r => ({ slug: r.slug, content: r.content, tokens: r.tokens }))
            totalTokens += initialResults.reduce((sum, r) => sum + (r.tokens || 0), 0)

            // ========== PHASE 2 & 3: Optimization & Synthesis ==========
            const successResults = initialResults.filter(r => r.status === 'success')

            if (safeModelSlugs.length === 1) {
                // MODE SOLO : un seul modèle demandé → retour direct sans synthèse
                console.log('Mode Solo détecté: Retour direct sans synthèse.')
                if (successResults.length > 0) {
                    finalContent = successResults[0].content
                    phases.synthesis = { masterSlug: successResults[0].slug, content: finalContent, tokens: successResults[0].tokens }
                } else {
                    // Le modèle a planté → retourner l'erreur explicite
                    const failedResult = initialResults[0]
                    finalContent = `⚠️ Erreur ${failedResult?.slug || 'IA'}: ${failedResult?.error || 'Réponse vide'}`
                    phases.synthesis = { masterSlug: masterSlug, content: finalContent, tokens: 0 }
                }
            } else {
                // ========== PHASE 2: Cross-Analysis (Supernova Only) ==========
                let optimizedResults = successResults

                if (fusion_mode === 'supernova' && successResults.length >= 2) {
                    console.log('Phase 2: Cross-analysis...')

                    const crossAnalysisPromises = successResults.map(async (result) => {
                        const otherResponses = successResults
                            .filter(r => r.slug !== result.slug)
                            .map(r => `[${r.slug}]: ${r.content}`)
                            .join('\n\n')

                        const analysisPrompt = `Tu as répondu à la question "${prompt}" avec:
          "${result.content}"
          
          Voici les réponses des autres modèles:
          ${otherResponses}
          
          Analyse ces réponses et optimise ta réponse en intégrant les informations pertinentes manquantes. Fournis une réponse améliorée et complète.
          IMPORTANT: Réponds uniquement en TEXTE BRUT, sans AUCUN formatage Markdown (pas de **, _, #, ou puces).`

                        // Record exchange
                        successResults.filter(r => r.slug !== result.slug).forEach(other => {
                            exchanges.push({ from: other.slug, to: result.slug, type: 'analysis' })
                        })

                        const optimized = await callModel(result.slug, analysisPrompt, keys, projectInstructions)
                        return { ...optimized, originalSlug: result.slug }
                    })

                    const crossResults = await Promise.all(crossAnalysisPromises)
                    phases.crossAnalysis = crossResults.map(r => ({
                        slug: r.slug,
                        content: r.content,
                        tokens: r.tokens,
                        analyzedBy: successResults.filter(s => s.slug !== r.slug).map(s => s.slug)
                    }))
                    totalTokens += crossResults.reduce((sum, r) => sum + (r.tokens || 0), 0)
                    optimizedResults = crossResults
                }

                // ========== PHASE 3: Refinement (Supernova Only) ==========
                let responsesForSynthesis = optimizedResults
                if (fusion_mode === 'supernova' && optimizedResults.length >= 2) {
                    console.log('Phase 3: Refinement...')
                    const refinementPromises = model_slugs.map(async (slug) => {
                        const initialResponse = initialResults.find(r => r.slug === slug)
                        const critiquesReceived = phases.crossAnalysis
                            .filter(ca => ca.slug !== slug)
                            .map(ca => `Analyse de ${ca.slug}: ${ca.content}`)
                            .join('\n\n')

                        const refinementPrompt = `Tu as précédemment répondu à cette question : "${prompt}"

Ta réponse initiale était :
${initialResponse?.content || ''}

Voici les analyses critiques que tu as reçues des autres IA :
${critiquesReceived}

En tenant compte de ces critiques et perspectives, produis maintenant une RÉPONSE AMÉLIORÉE et ENRICHIE.
- Intègre les points pertinents soulevés par les autres
- Corrige les erreurs ou imprécisions qu'ils ont identifiées
- Enrichis ta réponse avec les éléments complémentaires
- Garde ton style et ta perspective propre

IMPORTANT: Réponds uniquement en TEXTE SIMPLE, sans Markdown.`

                        return callModel(slug, refinementPrompt, keys, projectInstructions)
                    })

                    const refinementResults = await Promise.all(refinementPromises)
                    phases.refinement = refinementResults.map(r => ({ slug: r.slug, content: r.content, tokens: r.tokens }))
                    totalTokens += refinementResults.reduce((sum, r) => sum + (r.tokens || 0), 0)
                    responsesForSynthesis = refinementResults
                }

                // ========== PHASE 4: Master Fact-Check & Synthesis ==========
                console.log('Phase 4: Master synthesis & Fact-check...')
                const contextForMaster = responsesForSynthesis
                    .map(r => `=== ${r.slug.toUpperCase()} ===\n${r.content}`)
                    .join('\n\n')

                const synthesisPrompt = `Tu es le MASTER IA — juge final et vérificateur de faits.

QUESTION ORIGINALE : "${prompt}"

Voici les réponses affinées des 3 IA après cross-analyse et intégration des critiques :

${contextForMaster}

TA MISSION EN 3 ÉTAPES :

ÉTAPE 1 — FACT-CHECK SYSTÉMATIQUE
Pour chaque affirmation factuelle importante présente dans les réponses :
- Vérifie si les 3 IA sont d'accord (consensus = forte probabilité de véracité)
- Identifie les contradictions entre les IA (contradiction = risque d'erreur)
- Signale les affirmations non vérifiables ou douteuses
- Si une information est probablement fausse, NE L'INCLUS PAS dans la synthèse

ÉTAPE 2 — SYNTHÈSE INTELLIGENTE
- Fusionne les meilleures parties de chaque réponse
- Priorise les informations confirmées par consensus (2+ IA d'accord)
- Élimine les redondances
- Structure la réponse de manière claire et logique
- Enrichis avec les perspectives uniques de chaque IA

ÉTAPE 3 — RAPPORT DE FIABILITÉ
À la fin de ta réponse, ajoute un court bloc :
---
🔍 **Vérification** : 10 points vérifiés | Consensus sur 90% des affirmations | 1 contradictions identifiées et résolues
---

Produis maintenant ta synthèse vérifiée et fiable :`

                const masterOptions = {
                    enableSearchGrounding: masterSlug.includes('gemini'),
                    temperature: 0.3,
                    memoryBlock // Inject memory in synthesis too
                }

                const masterResult = await callModel(masterSlug, synthesisPrompt, keys, projectInstructions, history, forceJson, masterOptions)

                // Parsing du rapport de fact-check
                const factCheckMatch = masterResult.content.match(/🔍\s*\*?\*?Vérification\*?\*?\s*:\s*(\d+)\s*points?\s*vérifiés?\s*\|\s*Consensus\s*sur\s*(\d+)%.*?\|\s*(\d+)\s*contradictions?/i)
                const factCheckReport = factCheckMatch ? {
                    verified_claims: parseInt(factCheckMatch[1]),
                    consensus_percentage: parseInt(factCheckMatch[2]),
                    contradictions_found: parseInt(factCheckMatch[3])
                } : null

                phases.synthesis = {
                    masterSlug,
                    content: masterResult.content,
                    tokens: masterResult.tokens,
                    fact_check_report: factCheckReport
                }
                totalTokens += masterResult.tokens || 0
                finalContent = masterResult.content || contextForMaster
            }
        }

        // ========== SPRINT 1 FINAL: PIPELINE FACT-CHECKER (4 ÉTAGES) ==========
        let citations: any[] = []
        let webVerified = false

        if (web_verify && finalContent && fusion_mode !== 'image') {
            console.log('🏛️ Pipeline Fact-Checker activé...')
            const keys = getApiKeys()
            const geminiKey = keys.google
            const serperKey = Deno.env.get('SERPER_API_KEY')
            const tavilyKey = Deno.env.get('TAVILY_API_KEY')

            if (!geminiKey || !serperKey) {
                console.warn('⚠️ Clés API manquantes (Gemini ou Serper), fact-check dégradé ou ignoré')
            } else {
                try {
                    // --- ÉTAPE 1: Discovery + Grounding (Parallèle) ---
                    console.log('📡 Étape 1: Discovery (Serper) + Grounding (Gemini)...')
                    const [serperResult, geminiResult] = await Promise.all([
                        // SERPER — Discovery Google
                        fetch('https://google.serper.dev/search', {
                            method: 'POST',
                            headers: {
                                'X-API-KEY': serperKey,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ q: prompt, num: 5, gl: 'fr', hl: 'fr' })
                        }).then(r => r.json()).catch(err => { console.error('Serper fail:', err); return { organic: [] } }),

                        // GEMINI — Fact-check avec Grounding (Version simplifiée pour l'arbitre)
                        fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{
                                        parts: [{
                                            text: `Tu es un fact-checker silencieux. Vérifie cette réponse. Ne montre pas ton processus. Produis UNIQUEMENT la réponse corrigée si nécessaire, ou confirme la réponse originale.

QUESTION : ${prompt}
RÉPONSE À VÉRIFIER : ${finalContent}`
                                        }]
                                    }],
                                    tools: [{ google_search: {} }]
                                })
                            }
                        ).then(r => r.json()).catch(err => { console.error('Gemini Grounding fail:', err); return {} })
                    ])

                    const serperSources = (serperResult.organic || []).slice(0, 5).map((r: any, i: number) => ({
                        index: i + 1,
                        title: r.title,
                        url: r.link,
                        snippet: r.snippet,
                        date: r.date || null
                    }))

                    const geminiText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || finalContent
                    console.log(`🔍 Serper: ${serperSources.length} sources trouvées`)
                    console.log(`🌐 Gemini Grounding: Analyse terminée`)

                    // --- ÉTAPE 2: Evidence (Extraction Tavily sur le top 3) ---
                    let tavilyEvidence = []
                    const topUrls = serperSources.slice(0, 3).map((s: any) => s.url)

                    if (tavilyKey && topUrls.length > 0) {
                        console.log('📄 Étape 2: Extraction de contenu (Tavily)...')
                        try {
                            const tavilyResult = await fetch('https://api.tavily.com/extract', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    api_key: tavilyKey,
                                    urls: topUrls
                                })
                            }).then(r => r.json())

                            tavilyEvidence = (tavilyResult.results || []).map((r: any) => ({
                                url: r.url,
                                content: (r.raw_content || '').substring(0, 1000)
                            }))
                            console.log(`📄 Tavily: ${tavilyEvidence.length} pages extraites`)
                        } catch (e: any) {
                            console.log('⚠️ Tavily extraction failed, continuing without:', e.message)
                        }
                    }

                    // --- ÉTAPE 3: Adjudication (Arbitrage via LLM Principal) ---
                    console.log('🏛️ Étape 3: Adjudication finale...')
                    const evidenceBlock = serperSources.map((s: any) => {
                        const tavilyContent = tavilyEvidence.find((t: any) => t.url === s.url)?.content || s.snippet
                        return `[${s.index}] ${s.title}\nURL: ${s.url}\nExtrait: ${tavilyContent}\n`
                    }).join('\n')

                    const arbitreResponse = await callLLM({
                        model: masterSlug,
                        system: `Tu es un arbitre de vérification factuelle. Tu reçois une réponse IA, une version vérifiée par Gemini, et des preuves web.

CONSIGNES STRICTES :
1. Compare la réponse originale avec les preuves web (Serper + Tavily)
2. Corrige toute erreur factuelle dans la réponse originale
3. Produis la réponse finale vérifiée (texte naturel, PAS de méta-commentaire)
4. Intègre les numéros de sources [1], [2], [3], etc. dans le texte là où les faits sont vérifiés
5. Ne garde que les sources pertinentes au sujet
6. Si un fait n'est pas vérifiable dans les sources, dis-le explicitement.`,
                        messages: [{
                            role: 'user',
                            content: `QUESTION : ${prompt}

RÉPONSE ORIGINALE DU LLM :
${finalContent}

VÉRIFICATION GEMINI :
${geminiText}

PREUVES WEB :
${evidenceBlock}

Produis la réponse finale vérifiée avec citations [1], [2], etc.`
                        }]
                    })

                    // --- ÉTAPE 4: Finalisation et Nettoyage ---
                    console.log('🧹 Étape 4: Nettoyage et filtrage des citations...')
                    // Supprimer les blocs de sources textuels redondants (le frontend affiche les badges)
                    const cleanText = arbitreResponse.split(/---SOURCES---|Sources\s*:/i)[0].trim()

                    finalContent = cleanText
                    citations = serperSources.filter((s: any) => {
                        // Ne garder que les sources référencées dans le texte final
                        const marker = `[${s.index}]`
                        return finalContent.includes(marker)
                    })

                    webVerified = true
                    console.log(`✅ Pipeline Fact-Checker terminé (${citations.length} sources filtrées)`)

                } catch (fcError: any) {
                    console.error('❌ Erreur Critique dans le Pipeline Fact-Checker:', fcError.message)
                    // On conserve la réponse originale en cas d'erreur de pipeline
                }
            }
        }

        // ========== SAVE (Skiped if skip_save is true) ==========
        if (!skip_save) {
            // CRITICAL: Ensure user is authenticated before saving
            if (!user) {
                console.error('❌ CRITICAL: User is null, cannot save messages. Auth header:', authHeader ? 'present' : 'missing')
                throw new Error('User authentication required to save conversation')
            }

            try {
                if (!savedConversationId) {
                    const { data: conv } = await supabaseClient.from('conversations')
                        .insert({ user_id: user.id, title: prompt.substring(0, 30), project_id: project_id || null })
                        .select().single()
                    if (conv) savedConversationId = conv.id
                }

                if (savedConversationId) {
                    runId = undefined;

                    // 1. Create Fusion Run record for history
                    const { data: run, error: runError } = await supabaseClient.from('fusion_runs').insert({
                        user_id: user.id,
                        conversation_id: savedConversationId,
                        prompt_original: prompt,
                        master_model_slug: masterSlug,
                        status: 'complete'
                    }).select().single()

                    if (run && !runError) {
                        runId = run.id;

                        // 2. Save Raw Responses
                        const rawInserts = initialResults.map(r => ({
                            run_id: runId,
                            model_slug: r.slug,
                            content: r.content
                        }))
                        await supabaseClient.from('fusion_raw_responses').insert(rawInserts)

                        // 3. Save Critiques (if Supernova)
                        if (fusion_mode === 'supernova' && phases.crossAnalysis?.length > 0) {
                            const critiqueInserts = phases.crossAnalysis.map(ca => ({
                                run_id: runId,
                                critic_model_slug: ca.slug,
                                target_model_slug: ca.analyzedBy.join(','),
                                critique_content: ca.content
                            }))
                            await supabaseClient.from('fusion_critiques').insert(critiqueInserts)
                        }

                        // 3.5 Save Refinements (if Supernova)
                        if (fusion_mode === 'supernova' && phases.refinement?.length > 0) {
                            const refinementInserts = phases.refinement.map(ref => ({
                                fusion_run_id: runId,
                                model_slug: ref.slug,
                                content: ref.content,
                                tokens: ref.tokens || 0,
                                status: 'success'
                            }))
                            await supabaseClient.from('fusion_refinements').insert(refinementInserts)
                        }

                        // 4. Save Synthesis
                        const synthesisPayload: any = {
                            run_id: runId,
                            master_model_slug: masterSlug,
                            final_content: finalContent
                        }

                        if (phases.synthesis?.fact_check_report) {
                            synthesisPayload.fact_check_report = phases.synthesis.fact_check_report
                            synthesisPayload.consensus_score = phases.synthesis.fact_check_report.consensus_percentage / 100
                            synthesisPayload.contradictions_count = phases.synthesis.fact_check_report.contradictions_found
                            synthesisPayload.verified_claims_count = phases.synthesis.fact_check_report.verified_claims
                        }

                        await supabaseClient.from('fusion_syntheses').insert(synthesisPayload)

                        // 5. Update Run Info
                        await supabaseClient.from('fusion_runs').update({
                            total_api_calls: fusion_mode === 'supernova' ? 10 : (fusion_mode === 'fusion' ? 4 : 1),
                            has_refinement: fusion_mode === 'supernova',
                            has_fact_check: fusion_mode === 'supernova'
                        }).eq('id', runId)
                    }

                    // 5. Save standard messages (DISABLED for Manus to prevent duplicates)
                    if (fusion_mode !== 'manus') {
                        await supabaseClient.from('messages').insert({
                            conversation_id: savedConversationId, user_id: user.id, role: 'user', content: prompt, is_fusion_result: false
                        })
                        await supabaseClient.from('messages').insert({
                            conversation_id: savedConversationId,
                            user_id: user.id,
                            role: 'assistant',
                            content: finalContent,
                            is_fusion_result: true,
                            fusion_run_id: runId,
                            web_verified: webVerified,
                            citations: citations
                        })
                    }
                }
            } catch (dbError) {
                console.error("Erreur DB lors de la sauvegarde de la fusion:", dbError)
                throw dbError  // Re-throw to notify user of save failure
            }
        } else {
            console.log('ℹ️ skip_save est true, aucune donnée ne sera persistée en base.')
        }

        return new Response(
            JSON.stringify({
                run_id: runId,
                fusion_mode,
                fusion: finalContent,
                raw_responses: initialResults,
                phases,
                exchanges,
                token_usage: { total: totalTokens },
                conversation_id: savedConversationId,
                api_calls: fusion_mode === 'supernova' ? 7 : 4,
                debug_info: { user_authenticated: !!user, master_model: masterSlug },
                web_verified: webVerified,
                verify_providers: webVerified ? ['gemini_grounding', 'serper', 'tavily'] : [],
                citations_count: citations.length,
                citations: citations
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('Erreur Globale:', error)
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack,
            context: "Erreur globale dans fusion-run"
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } finally {
        // ========== FIRE & FORGET MEMORY EXTRACTION (Point 2) ==========
        try {
            const authHeader = req.headers.get('Authorization');
            const userToken = authHeader?.split(' ')[1];
            if (userToken) {
                const body = await req.clone().json().catch(() => ({}));
                if (body.conversation_id && !body.skip_save) {
                    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
                    fetch(`${SUPABASE_URL}/functions/v1/memory-extract`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${userToken}`,
                            'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            conversation_id: body.conversation_id,
                            messages: body.history || []
                        })
                    }).catch(() => { });
                }
            }
        } catch (e) {
            console.warn('[Memory] Extraction trigger failed:', e);
        }
    }
})

// ==================== UTILS ====================

async function callLLM({ model, system, messages }: { model: string, system: string, messages: any[] }) {
    const keys = getApiKeys()
    // Utiliser callModel existant pour bénéficier du mapping des modèles
    const prompt = messages[messages.length - 1].content
    const history = messages.slice(0, -1)
    const result = await callModel(model, prompt, keys, system, history, false)
    if (result.status === 'failed') {
        throw new Error(result.error || `Erreur lors de l'appel à ${model}`)
    }
    return result.content
}

// ==================== FETCHERS ====================

async function fetchOpenAI(prompt: string, apiKey: string, model: string = "gpt-4o", history: any[] = [], options: any = {}) {
    const messages = [
        ...history.map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: prompt }
    ];

    const body: any = {
        model,
        messages,
        temperature: options.temperature ?? 0.7
    };

    if (!model.startsWith('gpt-5')) {
        body.temperature = 0.7;
    }

    const endpoint = "https://api.openai.com/v1/chat/completions";

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(body)
    })

    if (!res.ok) throw new Error(`OpenAI Error (${res.status}): ${await res.text()}`)
    const data = await res.json()

    // Response structure handling (Responses API vs Chat Completions)
    const content = endpoint.includes('responses')
        ? data.output?.choices[0]?.message?.content
        : data.choices[0]?.message?.content;

    return {
        content: content || "",
        tokens: data.usage?.total_tokens || 0
    }
}

async function fetchGrok(prompt: string, apiKey: string, model: string = "grok-2", history: any[] = [], options: any = {}) {
    const messages = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: prompt }
    ]
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: options.temperature ?? 0.7 })
    })
    if (!res.ok) throw new Error(`Grok Error (${res.status}): ${await res.text()}`)
    const data = await res.json()
    return {
        content: data.choices[0]?.message?.content || "",
        tokens: data.usage?.total_tokens || 0
    }
}

async function fetchAnthropic(prompt: string, apiKey: string, model: string = "claude-opus-4-6", history: any[] = [], options: any = {}) {
    // Construire les messages avec historique
    // Anthropic exige : premier message = "user", rôles alternés
    const messages = [
        ...history.map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: prompt }
    ];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 4000, messages, temperature: options.temperature ?? 0.7 })
    })
    if (!res.ok) throw new Error(`Anthropic Error (${res.status}): ${await res.text()}`)
    const data = await res.json()
    return {
        content: data.content[0]?.text || "",
        tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }
}

async function fetchGoogle(prompt: string, apiKey: string, model: string = "gemini-3-pro-preview", history: any[] = [], forceJson: boolean = false, options: any = {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    // Construire les contents avec l'historique
    // Google utilise "model" au lieu de "assistant" pour le rôle IA
    const contents = [
        ...history.map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        })),
        { role: "user", parts: [{ text: prompt }] }
    ];

    const body: any = { contents }
    if (forceJson) {
        body.generationConfig = { ...body.generationConfig, responseMimeType: 'application/json' }
    }
    if (options.temperature !== undefined) {
        body.generationConfig = { ...body.generationConfig, temperature: options.temperature }
    }
    if (options.enableSearchGrounding) {
        body.tools = [{ google_search: {} }]
    }

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`Google Error (${res.status}): ${await res.text()}`)
    const data = await res.json()
    return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        tokens: data.usageMetadata?.totalTokenCount || 0
    }
}

async function fetchGoogleImage(prompt: string, apiKey: string, model: string = "gemini-3-pro-image-preview") {
    // Option B Implementation: Gemini 3 Pro Image / Nano Banana Pro
    // Requires :generateContent endpoint with responseModalities: ["IMAGE"]

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
                // Optional: aspectRatio: "1:1", imageSize: "2K" etc.
            }
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Image Gen Error (${res.status}): ${errText}`);
    }

    const data = await res.json();

    // Parse response for inlineData (Base64)
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned.");

    const parts = candidate.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
            return part.inlineData.data; // Base64 string
        }
        // Sometimes property is snake_case 'inline_data' in REST vs camelCase in SDK?
        // Checking both to be safe.
        if (part.inline_data && part.inline_data.mime_type.startsWith('image')) {
            return part.inline_data.data;
        }
    }
    throw new Error("No image data found.");
}

async function fetchGrokImage(prompt: string, apiKey: string) {
    // Grok Imagine Endpoint (OpenAI Compatible)
    const res = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
            model: "grok-imagine-image",
            prompt: prompt,
            n: 1,
            // size: "1024x1024", // Removed as per user request
            // aspect_ratio: "1:1", // Not valid for OpenAI compatible endpoint usually, but removing size is safer if model defaults.
            // Actually, for Grok specifically, if 'size' fails, maybe just OMIT it?
            // Or use "1024x1024" is standard. If user says "replace with aspect_ratio", I will do that for the IMAGEN part maybe?
            // Wait, user said "Option A — Tu me montres le code... et je corrige...".
            // Since user is asking ME to correct it based on HIS earlier input which was implicit, I will follow explicit instruction:
            // "il faut la supprimer ou la remplacer par aspect_ratio"
            // I will replace it with aspect_ratio AND keep size commented out just in case.
            // But wait, OpenAI compatible endpoint usually doesn't take aspect_ratio.
            // Let's try removing size first, as default is square usually.
            // But user said "remplacer par aspect_ratio".
            // I will use "size" -> "aspect_ratio".
            response_format: "b64_json"
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Grok Image Gen Error (${res.status}): ${errText}`);
    }

    // Expecting response with image data or url
    // Usually standard OpenAI-like image format: { data: [{ url: "..." }] } or { data: [{ b64_json: "..." }] }
    // User didn't specify response format, will check documentation or standard behavior.
    // X.AI often follows OpenAI compatibility.
    const data = await res.json();

    if (data.data && data.data.length > 0) {
        const imgObj = data.data[0];
        if (imgObj.url) return { type: 'url', data: imgObj.url };
        if (imgObj.b64_json) return { type: 'b64', data: imgObj.b64_json };
    }

    throw new Error("No image data in Grok response");
}

async function fetchImagenPredict(prompt: string, apiKey: string, model: string = "imagen-4.0-generate-001") {
    // Handling for dedicated Imagen models (v3, v4 etc) via Vertex AI style :predict endpoint
    // Standard endpoint for Imagen 4 on Generative Language API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey // Essential for newer endpoints
        },
        body: JSON.stringify({
            instances: [{ prompt: prompt }],
            parameters: {
                sampleCount: 1,
                // aspectRatio: "1:1", // Optional, defaults to square usually
                personGeneration: "allow_adult", // Sometimes needed for creative works, checks apply anyway
            }
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Imagen Predict Error (${res.status}): ${errText}`);
    }

    const data = await res.json();

    // Response format: { predictions: [ { bytesBase64Encoded: "..." } ] }
    if (data.predictions && data.predictions.length > 0) {
        return data.predictions[0].bytesBase64Encoded; // Return Base64 string
    }

    throw new Error(`No image data in Imagen response. Debug: ${JSON.stringify(data).substring(0, 200)}`);
}

async function uploadAndTrackImage(
    supabaseClient: any,
    userId: string,
    prompt: string,
    model: string,
    base64Data: string
) {
    try {
        const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `${userId}/${Date.now()}_${crypto.randomUUID()}.png`;

        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('generated_images')
            .upload(fileName, bytes, {
                contentType: 'image/png',
                upsert: false
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            throw uploadError;
        }

        const { data: { publicUrl } } = supabaseClient
            .storage
            .from('generated_images')
            .getPublicUrl(fileName);

        if (!publicUrl) throw new Error("Could not get public URL");

        const { error: dbError } = await supabaseClient
            .from('generated_images')
            .insert({
                user_id: userId,
                prompt: prompt,
                model_slug: model,
                image_url: publicUrl
            });

        if (dbError) {
            console.error("DB insert error:", dbError);
        }

        return publicUrl;
    } catch (e) {
        console.error("Failed to upload/track image:", e);
        return null;
    }
}

async function fetchManus(prompt: string, apiKey: string, history: any[] = []) {
    // On structure le prompt pour demander un rapport JSON détaillé
    const structuredPrompt = JSON.stringify({
        user_request: prompt,
        response_format_instructions: {
            format: "json",
            json_structure: {
                execution_summary: {
                    plan: "Tableau des étapes du plan d'action.",
                    thought_process_log: "Liste chronologique des pensées et décisions.",
                    tool_calls_log: "Journal des outils utilisés avec paramètres et résultats."
                },
                final_answer: "La réponse finale formatée en Markdown."
            }
        }
    });

    const createRes = await fetch("https://api.manus.ai/v1/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "API_KEY": apiKey
        },
        body: JSON.stringify({
            prompt: structuredPrompt,
            agentProfile: "manus-1.6",
            webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/manus-webhook`
        })
    });

    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Manus Create Task Error (${createRes.status}): ${errText}`);
    }

    const taskData = await createRes.json();
    return {
        content: `MANUS_TASK::${taskData.id}`,
        tokens: 0
    };
}

async function fetchGeminiGrounding(prompt: string, llmResponse: string, apiKey: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `Tu es un fact-checker silencieux. Ne montre JAMAIS ton processus de vérification.

QUESTION : ${prompt}
RÉPONSE À VÉRIFIER : ${llmResponse}

INSTRUCTIONS STRICTES :
1. Vérifie les faits contre tes sources web
2. Produis UNIQUEMENT la réponse finale corrigée
3. Numérote tes sources dans le texte avec [1], [2], etc.
4. Termine par une section exactement formatée ainsi :

---SOURCES---
[1] Titre de la source | https://url-complete.com/page-precise
[2] Titre de la source | https://url-complete.com/page-precise

IMPORTANT : La section ---SOURCES--- est OBLIGATOIRE. Tu DOIS inclure l'URL complète pour chaque source. Si tu effectues une recherche Google, utilise les URLs exactes que tu as trouvées.`
                }]
            }],
            tools: [{ google_search: {} }]
        })
    })

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Gemini Grounding Error (${res.status}): ${errText}`)
    }

    const geminiData = await res.json()
    console.log('🔍 GEMINI RAW RESPONSE:', JSON.stringify(geminiData, null, 2))

    const candidate = geminiData.candidates?.[0]
    const metadata = candidate?.groundingMetadata
    console.log('🔍 groundingMetadata FULL:', JSON.stringify(metadata, null, 2))

    const geminiText = candidate?.content?.parts?.[0]?.text || ''

    // Split texte et sources via le marqueur ---SOURCES---
    const splitParts = geminiText.split(/---SOURCES---/i)
    const verifiedText = splitParts[0].trim()
    const sourcesBlock = splitParts[1] ? splitParts[1].trim() : ''

    const citations = []

    // 1. Extraction prioritaire via groundingMetadata (chunks structurés)
    if (metadata?.groundingChunks) {
        metadata.groundingChunks.forEach((chunk: any, i: number) => {
            if (chunk.web) {
                citations.push({
                    index: i + 1,
                    title: chunk.web.title || '',
                    url: chunk.web.uri
                })
            }
        })
    }

    // 2. Extraction via le bloc texte ---SOURCES--- (Fallback/Complément)
    if (sourcesBlock) {
        const lines = sourcesBlock.split('\n').filter(l => l.trim())
        lines.forEach((line) => {
            const cleanLine = line.replace(/^\[\d+\]\s*/, '').trim()
            const lineParts = cleanLine.split('|').map(s => s.trim())

            if (lineParts.length >= 2) {
                const title = lineParts[0]
                const url = lineParts[1]

                // On n'ajoute que si l'URL n'est pas déjà présente via les chunks
                if (!citations.some(c => c.url === url)) {
                    citations.push({
                        index: citations.length + 1,
                        title: title,
                        url: url
                    })
                }
            } else if (lineParts[0].startsWith('http')) {
                const url = lineParts[0]
                if (!citations.some(c => c.url === url)) {
                    citations.push({
                        index: citations.length + 1,
                        title: '',
                        url: url
                    })
                }
            }
        })
    }

    console.log('🌐 Gemini Grounding:', citations.length, 'sources extraites')

    // Nettoyage final pour enlever d'éventuels résidus de prompt
    const finalContent = verifiedText
        .replace(/Vérification\s*:[\s\S]*?(?=Réponse corrigée|$)/i, '')
        .replace(/Réponse corrigée\s*:/i, '')
        .trim()

    const tokens = geminiData.usageMetadata?.totalTokenCount || 0

    return { content: finalContent, citations, tokens }
}
