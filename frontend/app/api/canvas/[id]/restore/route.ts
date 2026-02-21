import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/canvas/[id]/restore
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { version_id } = await request.json()

  // 1. Fetch the snapshot from the version
  const { data: version, error: versionError } = await supabase
    .from('canvas_versions')
    .select('content_snapshot')
    .eq('id', version_id)
    .eq('artifact_id', id)
    .single()

  if (versionError || !version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  // 2. Update the main artifact
  const { error: updateError } = await supabase
    .from('canvas_artifacts')
    .update({ content: version.content_snapshot })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to restore artifact' }, { status: 500 })
  }

  // 3. Create a "Restore" version entry
  await supabase
    .from('canvas_versions')
    .insert({
      artifact_id: id,
      user_id: user.id,
      summary: `Restauration de la version du ${new Date().toLocaleString()}`,
      content_snapshot: version.content_snapshot
    })

  return NextResponse.json({ success: true, content: version.content_snapshot })
}
