'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ItemInsert, ItemUpdate } from '@/types/database.types'

export async function getItems() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return { data: null, error: error.message }
    }

    return { data, error: null }
}

export async function getItem(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        return { data: null, error: error.message }
    }

    return { data, error: null }
}

export async function createItem(item: ItemInsert) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('items')
        .insert(item)
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/items')
    return { success: true, error: null, data }
}

export async function updateItem(id: string, item: ItemUpdate) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('items')
        .update(item)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/items')
    revalidatePath(`/admin/items/${id}/edit`)
    return { success: true, error: null, data }
}

export async function deleteItem(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/admin/items')
    return { success: true, error: null }
}

export async function uploadItemImage(formData: FormData) {
    const supabase = await createClient()

    const file = formData.get('file') as File
    if (!file) {
        return { success: false, error: 'No file provided', url: null }
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `items/${fileName}`

    const { error } = await supabase.storage
        .from('item-images')
        .upload(filePath, file)

    if (error) {
        return { success: false, error: error.message, url: null }
    }

    const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath)

    return { success: true, error: null, url: publicUrl }
}
