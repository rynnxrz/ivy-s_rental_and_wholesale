'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getCategories() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    if (error) throw error
    return data
}

export async function getCollections() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('name')

    if (error) throw error
    return data
}

export async function toggleCategoryVisibility(id: string, hidden: boolean) {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('categories')
        .update({ hidden_in_portal: hidden })
        .eq('id', id)

    if (error) throw error
    revalidatePath('/admin/settings')
    return { success: true }
}

export async function toggleCollectionVisibility(id: string, hidden: boolean) {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('collections')
        .update({ hidden_in_portal: hidden })
        .eq('id', id)

    if (error) throw error
    revalidatePath('/admin/settings')
    return { success: true }
}

export async function deleteCategory(id: string) {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

    if (error) throw error
    revalidatePath('/admin/settings')
    return { success: true }
}

export async function deleteCollection(id: string) {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id)

    if (error) throw error
    revalidatePath('/admin/settings')
    return { success: true }
}

const slugify = (value: string) => {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || `item-${Date.now()}`
}

export async function createCategory(name: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const slug = slugify(name)
    const { error } = await supabase
        .from('categories')
        .insert({ name, slug })

    if (error) throw error
    revalidatePath('/admin/settings')
    return { success: true }
}

export async function createCollection(name: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const slug = slugify(name)
    const { error } = await supabase
        .from('collections')
        .insert({ name, slug })

    if (error) throw error
    revalidatePath('/admin/settings')
    return { success: true }
}
