import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/canvas/[id] - Apply patch and create version
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { operations, summary } = await request.json()

  // 1. Fetch current version
  const { data: artifact, error: fetchError } = await supabase
    .from('canvas_artifacts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !artifact) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }

  // 2. Validate and apply operations
  let newContent = artifact.content

  try {
    const { applyPatch } = await import('@/lib/canvas/patching')
    newContent = applyPatch(artifact.content, operations)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  // 3. Save new content and create version in a transaction-like manner
  const { error: updateError } = await supabase
    .from('canvas_artifacts')
    .update({ content: newContent })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update artifact' }, { status: 500 })
  }

  const { data: version, error: versionError } = await supabase
    .from('canvas_versions')
    .insert({
      artifact_id: id,
      user_id: user.id,
      summary,
      operations,
      content_snapshot: newContent
    })
    .select()
    .single()

  return NextResponse.json({
    success: true,
    content: newContent,
    version_id: version?.id
  })
}

// GET /api/canvas/[id] - Fetch artifact
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: artifact, error } = await supabase
    .from('canvas_artifacts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !artifact) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(artifact)
}
