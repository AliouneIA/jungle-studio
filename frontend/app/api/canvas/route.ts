import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/canvas - Create new artifact
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, kind, language, project_id } = await request.json()

  const { data: artifact, error } = await supabase
    .from('canvas_artifacts')
    .insert({
      user_id: user.id,
      project_id: project_id || null,
      title: title || 'Nouveau Document',
      kind: kind || 'doc',
      language: language || (kind === 'code' ? 'typescript' : 'markdown'),
      content: ''
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(artifact)
}

// GET /api/canvas - List user artifacts
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: artifacts, error } = await supabase
    .from('canvas_artifacts')
    .select('id, title, kind, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(artifacts)
}
