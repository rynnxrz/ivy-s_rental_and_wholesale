import { ItemForm } from '@/components/admin/ItemForm'

export default function NewItemPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Add New Item</h1>
                <p className="text-slate-600">Create a new item in your rental catalog</p>
            </div>

            <ItemForm mode="create" />
        </div>
    )
}
