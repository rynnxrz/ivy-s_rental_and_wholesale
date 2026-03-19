import { createClient } from '@/lib/supabase/server'
import { LookbookImportClient } from './components/LookbookImportClient'

export default async function LookbookImportPage() {
  const supabase = await createClient()

  // Fetch recent import sessions for the sidebar/history
  const { data: sessions } = await supabase
    .from('lookbook_import_sessions')
    .select('id, source_file_name, status, page_count, created_at, series_plan, validation_summary')
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch categories for mapping
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  // Fetch collections
  const { data: collections } = await supabase
    .from('collections')
    .select('id, name')
    .order('name')

  return (
    <LookbookImportClient
      recentSessions={sessions || []}
      categories={categories || []}
      collections={collections || []}
    />
  )
}
