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

// ============================================================================
// AI Settings Actions
// ============================================================================

export async function saveAISettingsAction(settings: {
    ai_selected_model: string
    ai_prompt_category: string | null
    ai_prompt_subcategory: string | null
    ai_prompt_product_list: string | null
    ai_prompt_product_detail: string | null
}) {
    console.log('\n📝 [AI Settings] Saving AI Configuration...')
    console.log('   ├─ Model:', settings.ai_selected_model)
    console.log('   ├─ Category Prompt:', settings.ai_prompt_category ? '✓ Custom set' : '○ Using default')
    console.log('   ├─ Subcategory Prompt:', settings.ai_prompt_subcategory ? '✓ Custom set' : '○ Using default')
    console.log('   ├─ Product List Prompt:', settings.ai_prompt_product_list ? '✓ Custom set' : '○ Using default')
    console.log('   └─ Product Detail Prompt:', settings.ai_prompt_product_detail ? '✓ Custom set' : '○ Using default')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Update the single row in app_settings (assuming ID 1 or fetch single)
    // First, try to find the ID or upsert
    const { data: existing } = await supabase.from('app_settings').select('id').single()

    const { error } = await supabase
        .from('app_settings')
        .update(settings)
        .eq('id', existing?.id || 1) // Fallback to 1 if not found, though should exist

    if (error) {
        console.log('❌ [AI Settings] Save failed:', error.message)
        return { success: false, error: error.message }
    }

    console.log('✅ [AI Settings] Successfully saved to database\n')
    revalidatePath('/admin/items')
    return { success: true, error: null }
}

export async function restoreDefaultAISettingsAction() {
    // This is handled by setting fields to NULL in saveAISettingsAction if the UI sends null
    // But we can explicitly offer it here if needed.
    // For now, saveAISettingsAction is sufficient if UI sends nulls.
    return { success: true }
}

export async function getAISettingsAction() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('app_settings')
        .select('ai_selected_model, ai_prompt_category, ai_prompt_subcategory, ai_prompt_product_list, ai_prompt_product_detail')
        .single()

    if (error) {
        console.error('Failed to fetch AI settings:', error)
        return null
    }
    return data
}
