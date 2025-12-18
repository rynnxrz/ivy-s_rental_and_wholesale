import { notFound } from 'next/navigation'
import { getItem } from '@/actions/items'
import { ItemForm } from '@/components/admin/ItemForm'

interface EditItemPageProps {
    params: Promise<{ id: string }>
}

export default async function EditItemPage({ params }: EditItemPageProps) {
    const { id } = await params
    const { data: item, error } = await getItem(id)

    if (error || !item) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Edit Item</h1>
                <p className="text-slate-600">Update item: {item.name}</p>
            </div>

            <ItemForm item={item} mode="edit" />
        </div>
    )
}
