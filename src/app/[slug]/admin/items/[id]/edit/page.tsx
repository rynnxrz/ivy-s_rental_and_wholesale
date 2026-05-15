import { notFound } from 'next/navigation'
import { getItem } from '@/actions/items'
import { ItemForm } from '@/components/admin/ItemForm'
import { createClient } from '@/lib/supabase/server'

interface Props {
    params: Promise<{ slug: string; id: string }>
}

export default async function OrgEditItemPage({ params }: Props) {
    const { slug, id } = await params
    const basePath = `/${slug}/admin`
    const supabase = await createClient()

    const [itemResult, { data: categories }, { data: collections }] = await Promise.all([
        getItem(id),
        supabase.from('categories').select('*').order('name'),
        supabase.from('collections').select('*').order('name'),
    ])

    const { data: item, error } = itemResult
    if (error || !item) notFound()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Edit Item</h1>
                <p className="text-slate-600">Update item: {item.name}</p>
            </div>
            <ItemForm
                item={item}
                mode="edit"
                categories={categories || []}
                collections={collections || []}
                basePath={basePath}
            />
        </div>
    )
}
