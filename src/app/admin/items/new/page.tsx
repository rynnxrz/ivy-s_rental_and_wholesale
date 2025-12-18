'use client'

import { ItemForm } from '@/components/admin/ItemForm'

export default function NewItemPage() {
    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Add New Item</h1>
                <p className="text-gray-500 mt-2">Add a new piece to the rental collection.</p>
            </div>

            <ItemForm mode="create" />
        </div>
    )
}
