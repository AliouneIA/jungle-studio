// cspell:disable
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeepResearchInput {
  run_id: string
  query: string
  mode?: 'web' | 'urls' | 'docs' | 'mix'
  depth?: 'quick' | 'standard' | 'exhaustive'
  conversation_id?: string
  sites?: string[]
}

// Pipeline de recherche asynchrone (fire-and-forget)
async function runPipeline(run_id: string, query: string, mode: string, depth: string, conversation_id?: string, sites?: string[]) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log(`🚀 Starting pipeline for run_id: ${run_id}`)

  // Create message immediately so user sees progress
  if (conversation_id) {
    try {
      const { data: convData } = await supabase.from('conversations')
        .select('user_id')
        .eq('id', conversation_id)
        .single()

      if (convData?.user_id) {
        await supabase.from('messages').insert({
          conversation_id,
          user_id: convData.user_id,
          role: 'assistant',
          content: `🔬 Recherche approfondie en cours : "${query}"`,
          metadata: { type: 'research_report', research_run_id: run_id, query }
        })
        console.log('✅ Message créé pour afficher la progression en temps réel')
      }
    } catch (err) {
      console.error('⚠️ Failed to create initial message:', err)
    }
  }

  // Helper : mise à jour progression
  async function updateProgress(stage: string, percent: number, message: string) {
    console.log(`[${stage}] ${percent}% - ${message}`)
    try {
      await supabase.from('research_runs').update({
        status: percent >= 100 ? 'completed' : 'running',
        progress_stage: stage,
        progress_percent: percent,
        progress_message: message,
        updated_at: new Date().toISOString()
      }).eq('id', run_id)
    } catch (e) {
      console.error("Progress update failed:", e)
    }
  }

  // Helper : appel Gemini
  async function callGemini(prompt: string) {
    const apiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!apiKey) throw new Error("GOOGLE_API_KEY manquante")

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192 }
          })
        }
      )
      if (!res.ok) {
        const err = await res.text()
        console.error("Gemini API Error:", err)
        return ""
      }
      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (e: any) {
      console.error("Gemini call catch failed:", e)
      return ""
    }
  }

  // Config selon profondeur
  const config = {
    quick: { maxIterations: 2, axesCount: 3, sourcesPerAxe: 3, minCoverage: 60 },
    standard: { maxIterations: 3, axesCount: 5, sourcesPerAxe: 5, minCoverage: 75 },
    exhaustive: { maxIterations: 4, axesCount: 7, sourcesPerAxe: 8, minCoverage: 85 }
  }[depth as 'quick' | 'standard' | 'exhaustive'] || { maxIterations: 3, axesCount: 5, sourcesPerAxe: 5, minCoverage: 75 }

  try {
    // ═══════════════════════════════════════════
    // ÉTAPE 1 — CADRAGE (0-5%)
    // ═══════════════════════════════════════════
    await updateProgress('framing', 5, 'Analyse de la question et cadrage...')

    const scopeResponse = await callGemini(`Tu es un analyste de recherche senior.

Analyse cette question et produis un cadrage de recherche.

QUESTION : "${query}"

Réponds en JSON strict :
{
    "reformulation": "La question reformulée clairement",
    "objectif": "Ce que le rapport doit démontrer/expliquer",
    "perimetre": "Ce qui est inclus et exclu",
    "axes": [
        {
            "id": 1,
            "titre": "Titre de l'axe",
            "question": "La sous-question précise",
            "keywords_serper": ["mot clé 1", "mot clé 2", "mot clé 3"],
            "priorite": "haute|moyenne|basse"
        }
    ]
}

Génère exactement ${config.axesCount} axes. Les keywords_serper doivent être optimisés pour Google (courts, précis, en français).`)

    let plan
    try {
      const cleanJson = scopeResponse.replace(/```json\n?|```\n?/g, '').trim()
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/)
      plan = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch (e) {
      console.error("Erreur parsing plan:", e)
    }

    if (!plan || !plan.axes) {
      plan = {
        reformulation: query,
        objectif: "Répondre à la question",
        axes: [{ id: 1, titre: "Recherche générale", question: query, keywords_serper: [query] }]
      }
    }

    console.log('📋 Plan généré:', plan.axes.length, 'axes')
    await updateProgress('planning', 10, `Plan établi : ${plan.axes.length} axes de recherche`)

    // ═══════════════════════════════════════════
    // ÉTAPE 2 — BOUCLE ITÉRATIVE (10-80%)
    // ═══════════════════════════════════════════
    let allSources: any[] = []
    let allExtracts: any[] = []
    let coverageReport: any = null
    let pendingAxes = [...plan.axes]

    for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
      const iterationStart = 10 + ((iteration - 1) / config.maxIterations) * 70
      const iterationEnd = 10 + (iteration / config.maxIterations) * 70

      await updateProgress('collecting',
        Math.round(iterationStart),
        `Itération ${iteration}/${config.maxIterations} — Collecte sur ${pendingAxes.length} axes...`)

      // ─── 2A. COLLECTE SERPER ───
      const searchPromises = pendingAxes.map(async (axe: any) => {
        const keywords = axe.keywords_serper || [axe.question]
        const baseQuery = keywords.join(' ')
        const searchQuery = (sites && sites.length > 0)
          ? `${baseQuery} ${sites.map(s => `site:${s}`).join(' OR ')}`
          : baseQuery

        try {
          const serperRes = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': Deno.env.get('SERPER_API_KEY') || '',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              q: searchQuery,
              num: config.sourcesPerAxe,
              gl: 'fr',
              hl: 'fr'
            })
          })
          const data = await serperRes.json()
          return (data.organic || []).map((r: any) => ({
            ...r,
            axe_id: axe.id,
            axe_titre: axe.titre,
            iteration
          }))
        } catch (e: any) {
          console.log(`⚠️ Serper failed for axe ${axe.id}:`, e.message)
          return []
        }
      })

      const searchResults = (await Promise.all(searchPromises)).flat()

      const newSources = searchResults.filter((s: any) =>
        !allSources.some(existing => existing.link === s.link)
      )
      allSources = [...allSources, ...newSources]

      for (const source of newSources) {
        await supabase.from('research_sources').insert({
          run_id,
          title: source.title,
          url: source.link,
          snippet: source.snippet,
          provider: 'serper',
          relevance_score: source.position ? (1 - source.position / 10) : 0.5
        })
      }

      await updateProgress('collecting',
        Math.round(iterationStart + (iterationEnd - iterationStart) * 0.3),
        `${allSources.length} sources trouvées. Extraction du contenu...`)

      // ─── 2B. EXTRACTION TAVILY ───
      const urlsToExtract = newSources
        .slice(0, Math.min(config.sourcesPerAxe, 5))
        .map((s: any) => s.link)
        .filter((url: string) => url && url.startsWith('http'))

      if (urlsToExtract.length > 0) {
        try {
          const tavilyRes = await fetch('https://api.tavily.com/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: Deno.env.get('TAVILY_API_KEY'),
              urls: urlsToExtract
            })
          })
          const tavilyData = await tavilyRes.json()

          const extracts = (tavilyData.results || []).map((r: any) => ({
            url: r.url,
            content: (r.raw_content || '').substring(0, 4000),
            iteration
          }))
          allExtracts = [...allExtracts, ...extracts]

          for (const extract of extracts) {
            await supabase.from('research_sources')
              .update({ full_content: extract.content })
              .eq('run_id', run_id)
              .eq('url', extract.url)
          }
        } catch (e: any) {
          console.error("Tavily fail:", e)
        }
      }

      await updateProgress('collecting',
        Math.round(iterationStart + (iterationEnd - iterationStart) * 0.6),
        `Analyse de la couverture...`)

      // ─── 2C. ÉVALUATION DE COUVERTURE ───
      const sourceSummary = allSources.map((s, i) =>
        `[${i + 1}] ${s.title} — ${s.snippet || ''}`
      ).join('\n')

      const coveragePrompt = `Tu es un directeur de recherche. Évalue la couverture de cette recherche.
QUESTION ORIGINALE : "${query}"
AXES DE RECHERCHE : ${plan.axes.map((a: any) => `- ${a.titre}`).join('\n')}
SOURCES COLLECTÉES : ${sourceSummary}

Réponds en JSON strict :
{
    "coverage_score": 0-100,
    "suffisant_pour_rapport": true/false,
    "axes_incomplets": [],
    "justification": "..."
}`

      const coverageResponse = await callGemini(coveragePrompt)
      try {
        const jsonMatch = coverageResponse.match(/\{[\s\S]*\}/)
        coverageReport = jsonMatch ? JSON.parse(jsonMatch[0]) : null
      } catch (e) {
        coverageReport = { coverage_score: 80, suffisant_pour_rapport: true }
      }

      if (coverageReport?.suffisant_pour_rapport || (coverageReport?.coverage_score || 0) >= config.minCoverage) break

      pendingAxes = []
      if (coverageReport?.axes_incomplets) {
        for (const axeIncomplet of coverageReport.axes_incomplets) {
          pendingAxes.push({
            id: axeIncomplet.id,
            titre: `Complément axe ${axeIncomplet.id}`,
            question: axeIncomplet.manque,
            keywords_serper: axeIncomplet.nouvelles_requetes || [axeIncomplet.manque]
          })
        }
      }
      if (pendingAxes.length === 0) break
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 3 — SYNTHÈSE
    // ═══════════════════════════════════════════
    await updateProgress('synthesizing', 85, `Rédaction du rapport...`)

    const fullContext = allSources.map((s, i) => {
      const extract = allExtracts.find(e => e.url === s.link)
      return `[${i + 1}] ${s.title}\nURL: ${s.link}\n${extract ? `Contenu:\n${extract.content}` : `Résumé: ${s.snippet}`}\n`
    }).join('\n---\n')

    const reportPrompt = `Rédige un rapport de recherche approfondi sur "${query}".
SOURCES :
${fullContext.substring(0, 50000)}

CONSIGNES : Markdown haut de gamme, structuré, citations [N], ton pro, français, minimum 1500 mots.`

    const report = await callGemini(reportPrompt)

    // ═══════════════════════════════════════════
    // ÉTAPE 4 — FINALISATION
    // ═══════════════════════════════════════════
    await updateProgress('synthesizing', 100, 'Recherche terminée !')

    const titleMatch = report.match(/^#\s+(.+)$/m)
    const summaryMatch = report.match(/## (?:Synthèse|Résumé)[\s\S]*?\n([\s\S]*?)(?=\n## )/i)

    await supabase.from('research_runs').update({
      status: 'completed',
      report_markdown: report,
      report_title: titleMatch ? titleMatch[1] : query,
      executive_summary: summaryMatch ? summaryMatch[1].trim().substring(0, 500) : '',
      updated_at: new Date().toISOString()
    }).eq('id', run_id)

    console.log('✅ Recherche terminée ! Le message existant sera mis à jour automatiquement par real-time.')

  } catch (error: any) {
    console.error('❌ Pipeline error:', error)
    await updateProgress('failed', 0, 'Erreur : ' + error.message)
    await supabase.from('research_runs').update({
      status: 'failed',
      error_message: error.message,
      updated_at: new Date().toISOString()
    }).eq('id', run_id)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const input = await req.json().catch(() => null)
    if (!input) throw new Error("Body JSON manquant")

    const { run_id, query, mode = 'web', depth = 'standard', conversation_id, sites } = input as DeepResearchInput
    if (!run_id) throw new Error("run_id manquant")

    console.log(`📥 Invoke received: run_id=${run_id}, query=${query}`)

    const runtime = (globalThis as any).EdgeRuntime
    if (runtime && runtime.waitUntil) {
      runtime.waitUntil(runPipeline(run_id, query, mode, depth, conversation_id, sites))
    } else {
      runPipeline(run_id, query, mode, depth, conversation_id, sites)
    }

    return new Response(JSON.stringify({
      run_id,
      status: 'started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Invoke Handler Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
