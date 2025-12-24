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
    ai_prompt_quick_list?: string | null
    ai_prompt_product_detail: string | null
    ai_thinking_category?: string | null
    ai_thinking_subcategory?: string | null
    ai_thinking_product_list?: string | null
    ai_thinking_product_detail?: string | null
    ai_max_output_tokens?: number | null
    ai_use_system_instruction?: boolean
}) {
    console.log('\n📝 [AI Settings] Saving AI Configuration...')
    console.log('   ├─ Model:', settings.ai_selected_model)
    console.log('   ├─ Category Prompt:', settings.ai_prompt_category ? '✓ Custom set' : '○ Using default')
    console.log('   ├─ Subcategory Prompt:', settings.ai_prompt_subcategory ? '✓ Custom set' : '○ Using default')
    console.log('   ├─ Speed Scan Prompt:', settings.ai_prompt_quick_list ? '✓ Custom set' : '○ Using default')
    console.log('   ├─ Product List Prompt:', settings.ai_prompt_product_list ? '✓ Custom set' : '○ Using default')
    console.log('   ├─ Product Detail Prompt:', settings.ai_prompt_product_detail ? '✓ Custom set' : '○ Using default')
    console.log('   ├─ Thinking (Category):', settings.ai_thinking_category || 'default')
    console.log('   ├─ Thinking (Subcategory):', settings.ai_thinking_subcategory || 'default')
    console.log('   ├─ Thinking (Product List):', settings.ai_thinking_product_list || 'default')
    console.log('   ├─ Thinking (Product Detail):', settings.ai_thinking_product_detail || 'default')
    console.log('   ├─ Max Output Tokens:', settings.ai_max_output_tokens || 'default')
    console.log('   └─ Use System Instruction:', settings.ai_use_system_instruction ? '✓ Enabled' : '○ Disabled')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Fetch current row to get existing history
    const { data: existing, error: fetchError } = await supabase
        .from('app_settings')
        .select('id, prompt_history')
        .single()

    const missingHistoryColumn = !!fetchError?.message?.includes('prompt_history')
    const priorHistory = missingHistoryColumn
        ? {}
        : ((existing?.prompt_history as Record<string, string[]> | null) || {})
    const updateHistory = (key: string, value: string | null | undefined) => {
        if (!value) return priorHistory[key] || []
        const list = [value, ...(priorHistory[key] || [])].filter(Boolean)
        // Deduplicate while preserving order
        const deduped: string[] = []
        for (const entry of list) {
            if (!deduped.includes(entry) && deduped.length < 3) {
                deduped.push(entry)
            }
        }
        return deduped.slice(0, 3)
    }

    const prompt_history = {
        category: updateHistory('category', settings.ai_prompt_category),
        subcategory: updateHistory('subcategory', settings.ai_prompt_subcategory),
        quickList: updateHistory('quickList', settings.ai_prompt_quick_list ?? settings.ai_prompt_product_list),
        productList: updateHistory('productList', settings.ai_prompt_product_list),
        productDetail: updateHistory('productDetail', settings.ai_prompt_product_detail)
    }

    // Attempt full update first; if schema lacks new columns, fall back gracefully
    const fullPayload = { ...settings, prompt_history }
    const legacyPayload = {
        ai_selected_model: settings.ai_selected_model,
        ai_prompt_category: settings.ai_prompt_category,
        ai_prompt_subcategory: settings.ai_prompt_subcategory,
        ai_prompt_product_list: settings.ai_prompt_quick_list ?? settings.ai_prompt_product_list,
        ai_prompt_quick_list: settings.ai_prompt_quick_list ?? settings.ai_prompt_product_list,
        ai_prompt_product_detail: settings.ai_prompt_product_detail
    }

    const attemptUpdate = async (payload: Record<string, unknown>) =>
        supabase.from('app_settings').update(payload).eq('id', existing?.id || 1)

    let { error } = await attemptUpdate(fullPayload)

    if (error) {
        const isSchemaMissing =
            error.message?.includes('ai_thinking_') ||
            error.message?.includes('prompt_history') ||
            error.message?.includes('schema cache')

        if (isSchemaMissing) {
            console.warn('[AI Settings] Falling back to legacy columns (missing ai_thinking_* or prompt_history)')
            const fallback = await attemptUpdate(legacyPayload)
            error = fallback.error || null
        }
    }

    if (error) {
        console.log('❌ [AI Settings] Save failed:', error.message)
        const missingThinking = error.message?.includes('ai_thinking_')
        const missingPromptHistory = error.message?.includes('prompt_history')
        const hint =
            missingThinking || missingPromptHistory || error.message?.includes('schema cache')
                ? 'Missing AI settings columns in app_settings. Run supabase/migrations/00030_ai_thinking_levels.sql and supabase/migrations/00031_prompt_history.sql, then NOTIFY pgrst, \'reload schema\'.'
                : error.message
        return { success: false, error: hint }
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
    const baseSelect =
        'ai_selected_model, ai_prompt_category, ai_prompt_subcategory, ai_prompt_product_list, ai_prompt_quick_list, ai_prompt_product_detail'
    const fullSelect =
        `${baseSelect}, ai_thinking_category, ai_thinking_subcategory, ai_thinking_product_list, ai_thinking_product_detail, ai_max_output_tokens, ai_use_system_instruction, prompt_history`

    const { data, error } = await supabase
        .from('app_settings')
        .select(fullSelect)
        .single()

    if (!error) return data

    // Fallback for environments that have not yet added ai_thinking_* or prompt_history columns (so prompts still load)
    const missingThinking = error.message?.includes('ai_thinking_')
    const missingPromptHistory = error.message?.includes('prompt_history')
    const missingMaxTokens = error.message?.includes('ai_max_output_tokens')
    const needsFallback = missingThinking || missingPromptHistory || missingMaxTokens || error.message?.includes('schema cache')
    if (!needsFallback) {
        console.error('Failed to fetch AI settings:', error)
        return null
    }

    console.warn('[AI Settings] Falling back to legacy column set (missing ai_thinking_* or prompt_history or ai_max_output_tokens)')
    const fallbackSelect = missingPromptHistory ? baseSelect : `${baseSelect}, prompt_history`
    const { data: legacyData, error: legacyError } = await supabase
        .from('app_settings')
        .select(fallbackSelect)
        .single()

    if (legacyError || !legacyData) {
        console.error('Failed to fetch AI settings (legacy fallback):', legacyError)
        return null
    }

    return {
        ...(legacyData as any),
        ai_thinking_category: null,
        ai_thinking_subcategory: null,
        ai_thinking_product_list: null,
        ai_thinking_product_detail: null,
        ai_max_output_tokens: null,
        ai_use_system_instruction: false,
        prompt_history: missingPromptHistory ? {} : (legacyData as { prompt_history?: Record<string, string[]> }).prompt_history
    }
}
