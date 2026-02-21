import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { artifact_id, user_message, artifact_content, artifact_type, history, model } = await request.json()

  if (!user_message || !artifact_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // System prompt for strictly JSON output
  const systemPrompt = `Tu es l'assistant Canevas de Jungle Studio. 
L'utilisateur travaille sur le document suivant (${artifact_type}) :
---
${artifact_content}
---
Analyse sa demande et réponds EXCLUSIVEMENT sous forme de JSON valide. 
NE PAS inclure de texte avant ou après le JSON. NE PAS mettre de balises markdown de code block.

Structure attendue :
{
  "assistant_message": "Ton explication courte en français",
  "summary": "Résumé technique de la modification (ex: 'Ajout du titre')",
  "operations": [
    { "op": "replace|insert|delete", "start": number, "end": number, "text": "contenu si replace/insert" }
  ]
}

Règles :
- Si l'utilisateur demande une explication sans modification : operations doit être un tableau vide [].
- start et end sont des index de caractères (0-indexed).
- Pour tout réécrire : start: 0, end: ${artifact_content.length}.
- Sois précis sur les index pour ne pas corrompre le texte.`

  try {
    // Call the Edge Function from the server
    const { data, error } = await supabase.functions.invoke('fusion-run', {
      body: {
        prompt: user_message,
        fusion_mode: 'solo',
        master_model_slug: model || 'gpt-5.2',
        history: history || [],
        instructions: systemPrompt
      }
    })

    if (error) throw error

    const aiContent = data.fusion

    // Attempt to extract and parse JSON from the AI response
    let jsonResponse
    try {
      // Clean possible garbage around JSON
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("No JSON found in AI response")
      jsonResponse = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('AI Response parsing error:', aiContent)
      return NextResponse.json({
        error: 'L\'assistant a renvoyé une réponse malformée.',
        raw: aiContent
      }, { status: 500 })
    }

    return NextResponse.json(jsonResponse)

  } catch (err: any) {
    console.error('Canvas Assist Error:', err)
    return NextResponse.json({ error: 'Erreur lors de l\'appel à l\'assistant.' }, { status: 500 })
  }
}
