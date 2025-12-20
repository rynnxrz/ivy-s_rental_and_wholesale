'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ItemInsert, ItemUpdate } from '@/types'

const slugify = (value: string, prefix: string) => {
    const base = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')

    return base || `${prefix}-${Date.now()}`
}

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
        if (error.code === '23503') {
            return { success: false, error: 'DEPENDENCY_ERROR' }
        }
        return { success: false, error: error.message }
    }

    revalidatePath('/admin/items')
    return { success: true, error: null }
}

export async function archiveItem(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('items')
        .update({ status: 'retired' }) // Using 'retired' as the archived status based on enum usually
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
        .from('rental_items')
        .upload(filePath, file)

    if (error) {
        return { success: false, error: error.message, url: null }
    }

    const { data: { publicUrl } } = supabase.storage
        .from('rental_items')
        .getPublicUrl(filePath)

    return { success: true, error: null, url: publicUrl }
}

export async function createCategory(name: string) {
    const supabase = createServiceClient()
    const slug = slugify(name, 'category')

    const { data, error } = await supabase
        .from('categories')
        .insert({ name, slug })
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message, data: null }
    }

    // Revalidate paths where categories are used if necessary, but mainly for the form we use client state update or re-fetch
    revalidatePath('/admin/items/new')
    return { success: true, error: null, data }
}

export async function createCollection(name: string) {
    const supabase = createServiceClient()
    const slug = slugify(name, 'collection')

    const { data, error } = await supabase
        .from('collections')
        .insert({ name, slug })
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/items/new')
    return { success: true, error: null, data }
}
