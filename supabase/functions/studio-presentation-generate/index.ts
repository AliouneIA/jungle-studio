import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const {
      prompt,
      provider,
      num_slides,
      theme,
      tone,
      language,
      format,
      dimensions,
      text_mode,
      image_model,
      image_style,
      user_id,
      additional_instructions,
      audience,
      card_split,
      text_amount,
      image_source,
      image_keywords
    } = await req.json()

    if (!prompt || !user_id) throw new Error("prompt and user_id required")

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (provider === 'gamma') {
      const GAMMA_API_KEY = Deno.env.get('GAMMA_API_KEY')
      if (!GAMMA_API_KEY) throw new Error("GAMMA_API_KEY not set")

      // Mapper langue
      const LANGUAGE_MAP: Record<string, string> = {
        'Français': 'fr', 'français': 'fr', 'French': 'fr',
        'English': 'en', 'english': 'en',
        'Español': 'es', 'Deutsch': 'de', 'Italiano': 'it',
        'Português': 'pt-br', 'العربية': 'ar', '中文': 'zh-cn', '日本語': 'ja'
      }
      const langCode = LANGUAGE_MAP[language] || language || 'fr'

      // Construire le body Gamma (seulement les champs autorisés)
      const gammaBody: Record<string, unknown> = {
        inputText: prompt,
        textMode: text_mode || 'generate',
        format: format || 'presentation',
        numCards: num_slides || 10,
        cardSplit: card_split || 'auto'
      }

      // textOptions
      const textOpts: Record<string, string> = { amount: text_amount || 'medium' }
      if (langCode) textOpts.language = langCode
      if (tone) textOpts.tone = tone
      if (audience) textOpts.audience = audience
      gammaBody.textOptions = textOpts

      // imageOptions
      const imageOpts: Record<string, string> = { source: image_source || 'aiGenerated' }
      if (image_style) imageOpts.style = image_style
      if (image_model && image_model !== 'auto') imageOpts.model = image_model
      gammaBody.imageOptions = imageOpts

      // cardOptions
      if (dimensions) gammaBody.cardOptions = { dimensions }

      // themeId (seulement si c'est un vrai ID)
      if (theme && theme.length > 10 && !/^[A-Z]/.test(theme)) {
        gammaBody.themeId = theme
      }

      // additionalInstructions
      if (additional_instructions) gammaBody.additionalInstructions = additional_instructions

      // exportAs
      gammaBody.exportAs = 'pptx'

      console.log('🎬 Gamma POST body:', JSON.stringify(gammaBody, null, 2))

      // === ÉTAPE 1 : SOUMETTRE ===
      const submitRes = await fetch('https://public-api.gamma.app/v1.0/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': GAMMA_API_KEY
        },
        body: JSON.stringify(gammaBody)
      })

      const submitRaw = await submitRes.text()
      console.log('🔍 Gamma submit response:', submitRes.status, submitRaw)

      let submitData
      try { submitData = JSON.parse(submitRaw) } catch { throw new Error('Gamma non-JSON: ' + submitRaw.substring(0, 200)) }
      if (!submitRes.ok) throw new Error('Gamma submit error: ' + JSON.stringify(submitData))

      const generationId = submitData.generationId
      if (!generationId) throw new Error('No generationId returned')

      console.log('✅ Gamma generationId:', generationId)

      // === ÉTAPE 2 : SAUVEGARDER EN BASE (status=processing) ===
      const { data: inserted, error: dbError } = await supabase
        .from('presentations')
        .insert({
          user_id,
          title: prompt.substring(0, 100),
          prompt,
          provider: 'gamma',
          gamma_id: generationId,
          status: 'processing',
          num_slides: num_slides || 10,
          theme, tone, audience, language,
          format: format || 'presentation',
          dimensions: dimensions || '16x9',
          metadata: { generationId }
        })
        .select()
        .single()

      if (dbError) throw dbError

      // === ÉTAPE 3 : POLLER GAMMA (max 120 secondes) ===
      let gammaResult = null
      const maxAttempts = 40  // 40 x 3s = 120s
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000)) // attendre 3s

        const pollRes = await fetch(`https://public-api.gamma.app/v1.0/generations/${generationId}`, {
          headers: { 'X-API-KEY': GAMMA_API_KEY }
        })

        const pollRaw = await pollRes.text()
        console.log(`🔄 Gamma poll #${i + 1}:`, pollRaw.substring(0, 300))

        let pollData
        try { pollData = JSON.parse(pollRaw) } catch { continue }

        if (pollData.status === 'completed') {
          gammaResult = pollData
          break
        } else if (pollData.status === 'failed' || pollData.status === 'error') {
          throw new Error('Gamma generation failed: ' + JSON.stringify(pollData))
        }
        // sinon status === 'pending', on continue
      }

      if (!gammaResult) throw new Error('Gamma generation timed out after 120s')

      // === ÉTAPE 4 : METTRE À JOUR LA BASE ===
      const gammaUrl = gammaResult.gammaUrl || ''
      const pptxUrl = gammaResult.pptxUrl || gammaResult.exportUrl || ''
      const pdfUrl = gammaResult.pdfUrl || ''
      const title = gammaResult.title || prompt.substring(0, 100)

      await supabase
        .from('presentations')
        .update({
          status: 'done',
          gamma_url: gammaUrl,
          gamma_id: generationId,
          title,
          pptx_url: pptxUrl,
          pdf_url: pdfUrl,
          completed_at: new Date().toISOString()
        })
        .eq('id', inserted.id)

      console.log('✅ Gamma done! URL:', gammaUrl)

      return new Response(JSON.stringify({
        ...inserted,
        status: 'done',
        gamma_url: gammaUrl,
        pptx_url: pptxUrl,
        pdf_url: pdfUrl,
        title
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else {
      // GEMINI PROVIDER
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set")

      console.log('♊ Generating with Gemini:', prompt)

      const geminiPrompt = `Génère une structure de présentation détaillée pour le sujet suivant : "${prompt}".
      Le ton doit être ${tone || 'Professionnel'} et la langue ${language || 'Français'}.
      Génère exactement ${num_slides || 10} slides.
      Réponds UNIQUEMENT au format JSON comme suit :
      {
        "title": "Titre global",
        "slides": [
          { "title": "Titre slide", "content": ["point 1", "point 2"], "visual_suggestion": "description de l'image" }
        ]
      }`

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      })

      const rawText = await response.text()
      let geminiData
      try {
        const json = JSON.parse(rawText)
        const textContent = json.candidates[0].content.parts[0].text
        geminiData = JSON.parse(textContent)
      } catch (err) {
        throw new Error('Failed to parse Gemini response: ' + rawText.substring(0, 500))
      }

      const { data: row, error: dbErr } = await supabase.from('presentations').insert({
        user_id,
        title: geminiData.title || prompt.substring(0, 50),
        prompt,
        provider: 'gemini',
        num_slides: geminiData.slides?.length || num_slides || 10,
        language: language || 'Français',
        tone: tone || 'Professionnel',
        metadata: geminiData
      }).select().single()

      if (dbErr) throw dbErr

      return new Response(JSON.stringify(row), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (err) {
    const error = err as Error
    console.error('❌ Presentation Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
