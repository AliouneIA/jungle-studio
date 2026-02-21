import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/canvas/[id]/versions
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

  const { data: versions, error } = await supabase
    .from('canvas_versions')
    .select('id, summary, created_at')
    .eq('artifact_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(versions)
}
