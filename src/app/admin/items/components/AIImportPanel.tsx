'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Sparkles, ExternalLink, Check, Search, Settings, Zap } from 'lucide-react'
import {
    extractCategoriesStreamAction, // NEW: Streaming version
    ExtractedCategory,
    createStagingBatchAction,
    quickScanStreamAction, // NEW: Streaming version
    autoCategorizeStagingItemsAction,
    getStagingItemsAction,
    getAvailableModelsAction,
    exploreSubCategoriesAction,
    AvailableModel
} from '@/actions/items'
import { readStreamableValue } from '@/lib/ai-stream'
import { getAISettingsAction } from '@/app/admin/settings/actions'
import { AIImportSettings } from './AIImportSettings'
import { StagingItemsList } from './StagingItemsList'
import { toast } from 'sonner'
import type { StagingItem } from '@/types'
import { GEMINI_MODELS } from '@/types'
import { useAIWorkflow } from '@/hooks/useAIWorkflow'
import type { AIWorkflowState, LogEntry } from '@/hooks/useAIWorkflow'
import { AIStatusConsole } from '@/components/admin/AIStatusConsole'


interface Category {
    id: string
    name: string
}

interface Collection {
    id: string
    name: string
}

interface AIImportPanelProps {
    categories: Category[]
    collections: Collection[]  // NEW: For dual mapping
    onClose: () => void
}

interface CategoryMapping {
    extractedCategory: ExtractedCategory
    mappedCategoryId: string | null
    mappedCollectionId: string | null  // NEW: For dual mapping
    selectedForScan: boolean
}

type ViewMode = 'extract' | 'scanning' | 'results'

type CategoryExtractionChunk =
    | { type: 'chunk'; text: string; isThought?: boolean }
    | { type: 'usage'; usage: AIWorkflowState['usage'] }
    | { type: 'result'; success: boolean; categories?: ExtractedCategory[]; error?: string }

type QuickScanChunk =
    | { type: 'category_start'; categoryName: string }
    | { type: 'chunk'; text: string; isThought?: boolean }
    | { type: 'category_done'; categoryName: string; count: number }
    | { type: 'log'; message: string }
    | { type: 'result'; success: boolean; itemsFound: number; error?: string }

type RunHistoryEntry = {
    id: string
    url: string
    finishedAt: Date
    status: AIWorkflowState['status']
    logs: LogEntry[]
}

export function AIImportPanel({ categories, collections, onClose }: AIImportPanelProps) {
    const [url, setUrl] = useState('')
    const [isPending, startTransition] = useTransition()
    const [extractedCategories, setExtractedCategories] = useState<CategoryMapping[]>([])
    const [hasExtracted, setHasExtracted] = useState(false)

    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash')
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [aiSettings, setAiSettings] = useState<{
        selectedModel: string
        promptCategory: string | null
        promptSubcategory: string | null
        promptProductList: string | null
        promptQuickList: string | null
        promptProductDetail: string | null
        thinkingCategory: string | null
        thinkingSubcategory: string | null
        thinkingProductList: string | null
        thinkingProductDetail: string | null
        maxOutputTokens: number | null
        useSystemInstruction: boolean
        promptHistory?: Record<string, string[]>
    }>({
        selectedModel: 'gemini-2.0-flash',
        promptCategory: null,
        promptSubcategory: null,
        promptProductList: null,
        promptQuickList: null,
        promptProductDetail: null,
        thinkingCategory: null,
        thinkingSubcategory: null,
        thinkingProductList: null,
        thinkingProductDetail: null,
        maxOutputTokens: null,
        useSystemInstruction: false,
        promptHistory: {}
    })

    // Dynamic model list state
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])

    // Fetch available models on mount
    useEffect(() => {
        const fetchModelsAndSettings = async () => {
            // Fetch models
            const modelsResult = await getAvailableModelsAction()
            if (modelsResult.success && modelsResult.models.length > 0) {
                setAvailableModels(modelsResult.models)
            } else {
                setAvailableModels(GEMINI_MODELS.map(m => ({
                    id: m.id,
                    name: m.name,
                    displayName: m.name,
                    description: ''
                })))
            }

            // Fetch settings
            const settings = await getAISettingsAction()
            if (settings) {
                setAiSettings({
                    selectedModel: settings.ai_selected_model || 'gemini-2.0-flash',
                    promptCategory: settings.ai_prompt_category,
                    promptSubcategory: settings.ai_prompt_subcategory,
                    promptProductList: settings.ai_prompt_product_list,
                    promptQuickList: settings.ai_prompt_quick_list,
                    promptProductDetail: settings.ai_prompt_product_detail,
                    thinkingCategory: settings.ai_thinking_category,
                    thinkingSubcategory: settings.ai_thinking_subcategory,
                    thinkingProductList: settings.ai_thinking_product_list,
                    thinkingProductDetail: settings.ai_thinking_product_detail,
                    maxOutputTokens: settings.ai_max_output_tokens ?? null,
                    useSystemInstruction: settings.ai_use_system_instruction ?? false,
                    promptHistory: (settings && 'prompt_history' in settings ? (settings as { prompt_history?: Record<string, string[]> }).prompt_history : {}) || {}
                })
                setSelectedModel(settings.ai_selected_model || 'gemini-2.0-flash')
            }
        }
        fetchModelsAndSettings()
    }, [])


    // Scanning state
    const [viewMode, setViewMode] = useState<ViewMode>('extract')
    const [batchId, setBatchId] = useState<string | null>(null)
    const [stagingItems, setStagingItems] = useState<StagingItem[]>([])
    const [isScanning, setIsScanning] = useState(false)
    const [isClassifying, setIsClassifying] = useState(false)
    const [classifySummary, setClassifySummary] = useState<string | null>(null)

    // AI Workflow state (replaces simple loadingStep)
    const {
        state: aiState,
        addLog,
        updateLastLog,
        setCurrentItem,
        setStatus,
        reset: resetAIWorkflow,
        setUsage,
        appendToLastLog // NEW: For streaming text
    } = useAIWorkflow()

    const [consoleOpen, setConsoleOpen] = useState(false)
    const [currentRunId, setCurrentRunId] = useState<string | null>(null)
    const [currentRunUrl, setCurrentRunUrl] = useState<string | null>(null)
    const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([])
    const [activeRunId, setActiveRunId] = useState<string | null>(null)
    const aiStateRef = useRef(aiState)

    useEffect(() => {
        aiStateRef.current = aiState
    }, [aiState])

    useEffect(() => {
        if (!activeRunId && runHistory.length > 0) {
            setActiveRunId(runHistory[0].id)
        }
    }, [runHistory, activeRunId])

    const archiveRun = useCallback((status: AIWorkflowState['status']) => {
        const id = currentRunId || `run-${Date.now()}`
        const snapshot: RunHistoryEntry = {
            id,
            url: currentRunUrl || url,
            finishedAt: new Date(),
            status,
            logs: [...aiStateRef.current.logs]
        }

        setRunHistory(prev => {
            const filtered = prev.filter(r => r.id !== id)
            return [snapshot, ...filtered].slice(0, 10)
        })
        setActiveRunId(id)
        setConsoleOpen(false)
    }, [currentRunId, currentRunUrl, url])

    // Loading step messages (kept for backward compatibility)
    const [loadingStep, setLoadingStep] = useState<string>('')

    const handleExtract = () => {
        if (!url.trim()) {
            toast.error('Please enter a URL')
            return
        }

        setClassifySummary(null)

        // Reset and prepare console
        resetAIWorkflow()
        const newRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        setCurrentRunId(newRunId)
        setActiveRunId(newRunId)
        setCurrentRunUrl(url)
        setConsoleOpen(true)

        startTransition(async () => {
            // Extract domain for display
            const domain = new URL(url).hostname
            setLoadingStep('Analyzing website structure...')

            // Reset and start workflow
            resetAIWorkflow()
            setStatus('analyzing')
            addLog(`Analyzing ${domain}...`, 'loading', 'Fetch')

            try {
                const { output } = await extractCategoriesStreamAction(url, selectedModel)

                let scanSuccess = false
                let scanError = null
                let categoriesResult: ExtractedCategory[] = []

                for await (const chunk of readStreamableValue<CategoryExtractionChunk>(output)) {
                    if (chunk.type === 'chunk') {
                        if (chunk.isThought) {
                            // Real-time append to last thought line or new one
                            const lastLog = aiState.logs[aiState.logs.length - 1]
                            if (lastLog?.tag === 'Thinking' && lastLog?.type === 'loading') {
                                appendToLastLog(chunk.text)
                            } else {
                                addLog(chunk.text, 'loading', 'Thinking')
                            }
                        }
                    } else if (chunk.type === 'usage') {
                        // Update usage stats
                        setUsage(chunk.usage)
                    } else if (chunk.type === 'result') {
                        if (chunk.success) {
                            scanSuccess = true
                            categoriesResult = chunk.categories || []
                        } else {
                            scanError = chunk.error
                        }
                    }
                }

                setLoadingStep('')

                if (!scanSuccess) {
                    addLog(`Analysis failed: ${scanError}`, 'error', 'Error')
                    toast.error(scanError || 'Failed to extract categories')
                    setStatus('error')
                    archiveRun('error')
                    return
                }

                if (categoriesResult.length === 0) {
                    addLog('No categories found on this page', 'warning', 'Discovery')
                    toast.warning('No categories found on this page')
                    setStatus('idle')
                    archiveRun('idle')
                    return
                }

                // Log final success
                setStatus('success')
                addLog(`Successfully connected to ${domain}`, 'success', 'Fetch')

                // Log each category found
                const categoryNames = categoriesResult.slice(0, 4).map(c => c.name).join(', ')
                const moreCount = categoriesResult.length > 4 ? ` +${categoriesResult.length - 4} more` : ''
                addLog(`Found ${categoriesResult.length} items: ${categoryNames}${moreCount}`, 'success', 'Discovery')

                // Initialize mappings with auto-matching
                const mappings: CategoryMapping[] = categoriesResult.map(cat => {
                    const matchedCategory = cat.suggestedType === 'category'
                        ? categories.find(c => c.name.toLowerCase() === cat.name.toLowerCase())
                        : null

                    const matchedCollection = cat.suggestedType === 'collection'
                        ? collections.find(c => c.name.toLowerCase() === cat.name.toLowerCase())
                        : null

                    return {
                        extractedCategory: cat,
                        mappedCategoryId: matchedCategory?.id || null,
                        mappedCollectionId: matchedCollection?.id || null,
                        selectedForScan: false
                    }
                })

                setExtractedCategories(mappings)
                setHasExtracted(true)
                toast.success(`Found ${categoriesResult.length} categories`)
                archiveRun('success')

            } catch (error) {
                console.error("Extraction Stream failed:", error)
                addLog(`Stream error: ${error}`, 'error', 'Error')
                setStatus('error')
                archiveRun('error')
            }
        })
    }

    const handleStartScan = async () => {
        const selectedCategories = extractedCategories
            .filter(c => c.selectedForScan && c.extractedCategory.url)
            .map(c => ({
                name: c.extractedCategory.name,
                url: c.extractedCategory.url!,
                categoryId: c.mappedCategoryId,
                collectionId: c.mappedCollectionId
            }))

        if (selectedCategories.length === 0) {
            toast.error('Please select at least one category to scan')
            return
        }

        setClassifySummary(null)

        // Reset and prepare console for scan
        resetAIWorkflow()
        setStatus('analyzing')

        setBatchId(null)
        setViewMode('scanning')
        setIsScanning(true)
        setLoadingStep(`Speed scanning ${selectedCategories.length} category pages...`)

        // Create batch in background
        const { batchId: newBatchId, error } = await createStagingBatchAction(url)
        if (error || !newBatchId) {
            addLog(`Failed to create batch: ${error}`, 'error', 'Error')
            toast.error(error || 'Failed to create import batch')
            setLoadingStep('')
            setViewMode('extract')
            setIsScanning(false)
            return
        }

        setBatchId(newBatchId)
        setCurrentItem(`Processing ${selectedCategories.length} categories...`)

        // Start Streaming Quick Scan
        try {
            const { output } = await quickScanStreamAction({ categories: selectedCategories }, newBatchId, selectedModel)

            let itemsFound = 0
            let scanSuccess = false
            let scanError = null

            for await (const chunk of readStreamableValue<QuickScanChunk>(output)) {
                if (chunk.type === 'category_start') {
                    setCurrentItem(`Scanning: ${chunk.categoryName}`)
                    addLog(`Accessing ${chunk.categoryName}...`, 'loading', 'Fetch')
                } else if (chunk.type === 'chunk') {
                    if (chunk.isThought) {
                        const lastLog = aiState.logs[aiState.logs.length - 1]
                        if (lastLog?.tag === 'Thinking' && lastLog?.type === 'loading') {
                            appendToLastLog(chunk.text)
                        } else {
                            addLog(chunk.text, 'loading', 'Thinking')
                        }
                    }
                } else if (chunk.type === 'category_done') {
                    // Mark previous Thinking log as success before stating category done
                    const lastLog = aiState.logs[aiState.logs.length - 1]
                    if (lastLog?.tag === 'Thinking') {
                        updateLastLog({ type: 'success' })
                    }
                    addLog(`Found ${chunk.count} items in ${chunk.categoryName}`, 'success', 'Discovery')
                } else if (chunk.type === 'log') {
                    addLog(chunk.message, 'warning', 'System')
                } else if (chunk.type === 'result') {
                    if (chunk.success) {
                        itemsFound = chunk.itemsFound
                        scanSuccess = true
                    } else {
                        scanError = chunk.error
                    }
                }
            }

            setIsScanning(false)
            setCurrentItem(null)
            setLoadingStep('')

            if (!scanSuccess) {
                setStatus('error')
                addLog(scanError || 'Quick scan failed', 'error', 'Error')
                toast.error(scanError || 'Quick scan failed')
                setViewMode('extract')
                return
            }

            // Log success details
            setStatus('success')
            addLog(`Batch created: ${newBatchId.substring(0, 8)}...`, 'success', 'System')
            addLog(`Found ${itemsFound} products across all categories`, 'success', 'Discovery')

            // Log variant detection hint
            if (itemsFound > 0) {
                addLog('Products ready for review and grouping', 'info', 'Logic')
            }

            toast.success(`Found ${itemsFound} items (speed scan)`)

            // Allow user to read the logs before switching
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Fetch results immediately
            const { data } = await getStagingItemsAction(newBatchId)
            setStagingItems(data || [])
            setViewMode('results')

        } catch (error) {
            console.error("Quick Scan Stream failed:", error)
            addLog(`Stream error: ${error}`, 'error', 'Error')
            setIsScanning(false)
        }

    }

    const handleAutoCategorize = async () => {
        if (!batchId) {
            toast.error('No active batch to categorize')
            return
        }

        setIsClassifying(true)
        setClassifySummary(null)

        const result = await autoCategorizeStagingItemsAction(batchId, selectedModel)
        setIsClassifying(false)

        if (!result.success) {
            toast.error(result.error || 'AI 分类失败')
            return
        }

        setClassifySummary(`已更新 ${result.updatedCount} 条，未匹配 ${result.unmatched.length} 条`)
        toast.success(`AI 分类完成：${result.updatedCount} 条已匹配`)

        const { data } = await getStagingItemsAction(batchId)
        setStagingItems(data || [])
    }

    const updateMapping = (index: number, categoryId: string | null) => {
        setExtractedCategories(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], mappedCategoryId: categoryId }
            return updated
        })
    }

    const updateCollectionMapping = (index: number, collectionId: string | null) => {
        setExtractedCategories(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], mappedCollectionId: collectionId }
            return updated
        })
    }

    // State for tracking which row is being explored
    const [exploringIndex, setExploringIndex] = useState<number | null>(null)

    const handleExploreDepth = async (index: number) => {
        const mapping = extractedCategories[index]
        if (!mapping.extractedCategory.url) {
            toast.error('No URL available to explore')
            return
        }

        setExploringIndex(index)

        const result = await exploreSubCategoriesAction(
            mapping.extractedCategory.url,
            mapping.extractedCategory.name,
            selectedModel
        )

        setExploringIndex(null)

        if (!result.success) {
            toast.error(result.error || 'Failed to explore sub-categories')
            return
        }

        if (result.subCategories.length === 0) {
            toast.info('No sub-categories found on this page')
            return
        }

        // Add new sub-categories as new rows
        const newMappings: CategoryMapping[] = result.subCategories.map(subCat => {
            // Smart auto-suggestion based on suggestedType
            const matchedCategory = subCat.suggestedType === 'category'
                ? categories.find(c => c.name.toLowerCase().includes(subCat.name.toLowerCase().split(' ')[0]) ||
                    subCat.name.toLowerCase().includes(c.name.toLowerCase()))
                : null

            const matchedCollection = subCat.suggestedType === 'collection'
                ? collections.find(c => c.name.toLowerCase().includes(subCat.name.toLowerCase().split(' ')[0]) ||
                    subCat.name.toLowerCase().includes(c.name.toLowerCase()))
                : null

            return {
                extractedCategory: subCat,
                mappedCategoryId: matchedCategory?.id || null,
                mappedCollectionId: matchedCollection?.id || null,
                selectedForScan: false
            }
        })

        // Insert new mappings after the current index
        setExtractedCategories(prev => [
            ...prev.slice(0, index + 1),
            ...newMappings,
            ...prev.slice(index + 1)
        ])

        toast.success(`Found ${result.subCategories.length} sub-categories`)
    }

    const toggleScanSelection = (index: number) => {
        setExtractedCategories(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], selectedForScan: !updated[index].selectedForScan }
            return updated
        })
    }

    const selectedCount = extractedCategories.filter(c => c.selectedForScan).length

    const displayedConsoleState: AIWorkflowState = (() => {
        if (activeRunId && activeRunId === currentRunId) {
            return aiState
        }

        const fallbackEntry = activeRunId
            ? runHistory.find(r => r.id === activeRunId)
            : runHistory[0]

        if (fallbackEntry) {
            return {
                status: fallbackEntry.status,
                logs: fallbackEntry.logs,
                currentItem: null,
                usage: undefined
            }
        }

        return aiState
    })()

    // Scanning View - Quick scan mode (completes in seconds)
    if (viewMode === 'scanning') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-purple-600 animate-pulse" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            Quick Scanning
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-normal">
                                Fast Mode
                            </span>
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {loadingStep || 'Extracting products from category listings...'}
                        </p>
                    </div>
                    {isScanning && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                            <span>Processing...</span>
                        </div>
                    )}
                </div>

                {/* AI Status Console - Terminal-style log display */}
                <AIStatusConsole
                    state={aiState}
                    isOpen={true}
                    title="AI Console"
                    maxHeight={280}
                />

                <p className="text-xs text-center text-muted-foreground">
                    This should only take a few seconds
                </p>
            </div>
        )
    }

    // Results View
    if (viewMode === 'results' && batchId) {
        // Construct a temporary batch object for the list component
        const currentBatch = {
            id: batchId,
            source_url: url,
            status: 'completed', // Quick scan is done
            created_at: new Date().toISOString(),
            items_scraped: stagingItems.length,
            pending_count: stagingItems.length
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <Button variant="ghost" size="icon" onClick={() => {
                        setViewMode('extract')
                        setStagingItems([])
                        setBatchId(null)
                        setClassifySummary(null)
                    }}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Speed Scan Results</h2>
                        <p className="text-sm text-slate-500">Review and classify your scanned items.</p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        {classifySummary && (
                            <span className="text-xs text-slate-500">{classifySummary}</span>
                        )}
                        <Button
                            onClick={handleAutoCategorize}
                            disabled={isClassifying || !batchId || stagingItems.length === 0}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {isClassifying ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            AI 分类
                        </Button>
                    </div>
                </div>

                <div className="bg-slate-50/50 rounded-xl border p-1">
                    <StagingItemsList
                        batches={[currentBatch]}
                        categories={categories}
                        collections={collections}
                        onClose={onClose}
                    />
                </div>
            </div>
        )
    }

    // Extract View (default)
    return (
        <div className="space-y-6">
            {/* Header */}
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        AI Import
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Extract and map categories from an e-commerce website
                    </p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <div className="flex flex-col items-end mr-2">
                        <span className="text-xs font-medium">
                            {availableModels.find(m => m.id === selectedModel)?.displayName || selectedModel}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {availableModels.find(m => m.id === selectedModel)?.inputTokenLimit
                                ? `${Math.round(availableModels.find(m => m.id === selectedModel)!.inputTokenLimit! / 1000)}K context`
                                : 'Active Model'}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSettingsOpen(true)}
                        title="AI Configuration"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <AIImportSettings
                open={settingsOpen}
                onOpenChange={(open) => {
                    setSettingsOpen(open)
                    if (!open) {
                        // Refresh settings when closed (in case they changed)
                        getAISettingsAction().then(settings => {
                            if (settings) {
                                setAiSettings({
                                    selectedModel: settings.ai_selected_model || 'gemini-2.0-flash',
                                    promptCategory: settings.ai_prompt_category,
                                    promptSubcategory: settings.ai_prompt_subcategory,
                                    promptProductList: settings.ai_prompt_product_list,
                                    promptQuickList: settings.ai_prompt_quick_list,
                                    promptProductDetail: settings.ai_prompt_product_detail,
                                    thinkingCategory: settings.ai_thinking_category,
                                    thinkingSubcategory: settings.ai_thinking_subcategory,
                                    thinkingProductList: settings.ai_thinking_product_list,
                                    thinkingProductDetail: settings.ai_thinking_product_detail,
                                    maxOutputTokens: settings.ai_max_output_tokens ?? null,
                                    useSystemInstruction: settings.ai_use_system_instruction ?? false
                                })
                                setSelectedModel(settings.ai_selected_model || 'gemini-2.0-flash')
                            }
                        })
                    }
                }}
                availableModels={availableModels}
                initialSettings={aiSettings}
            />

            {/* URL Input */}
            <div className="space-y-2">
                <Label htmlFor="source-url">Source URL</Label>
                <div className="flex gap-2">
                    <Input
                        id="source-url"
                        placeholder="https://example.com/collections"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isPending}
                        className="flex-1"
                    />
                    <Button onClick={handleExtract} disabled={isPending || !url.trim()} className="min-w-[160px]">
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {loadingStep || 'Extracting...'}
                            </>
                        ) : (
                            'Extract Categories'
                        )}
                    </Button>
                </div>
                {isPending && loadingStep && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                        ⏳ {loadingStep}
                    </p>
                )}

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConsoleOpen(prev => !prev)}
                        className="h-9"
                    >
                        Extraction Console
                        {runHistory.length > 0 && (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                {runHistory.length}
                            </span>
                        )}
                    </Button>
                    {(aiState.status !== 'idle' || runHistory.length > 0) && (
                        <Select
                            value={(activeRunId || currentRunId || runHistory[0]?.id) ?? undefined}
                            onValueChange={(value) => setActiveRunId(value)}
                        >
                            <SelectTrigger className="h-9 w-[260px]">
                                <SelectValue placeholder="Select run to view logs" />
                            </SelectTrigger>
                            <SelectContent>
                                {currentRunId && (
                                    <SelectItem value={currentRunId}>
                                        Current run (in progress)
                                    </SelectItem>
                                )}
                                {runHistory.map((run) => (
                                    <SelectItem key={run.id} value={run.id}>
                                        {new Date(run.finishedAt).toLocaleTimeString()} – {run.url}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {(consoleOpen || aiState.status !== 'idle') && (
                    <AIStatusConsole
                        state={displayedConsoleState}
                        isOpen={true}
                        title="Extraction Console"
                        maxHeight={200}
                        className="animate-in fade-in slide-in-from-top-2 duration-300"
                    />
                )}
            </div>

            {/* Extracted Categories */}
            {hasExtracted && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium">
                            Extracted Categories ({extractedCategories.length})
                        </h3>
                        {selectedCount > 0 && (
                            <span className="text-sm text-muted-foreground">
                                {selectedCount} selected for speed scan
                            </span>
                        )}
                    </div>

                    {extractedCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            No categories were found on this page
                        </p>
                    ) : (
                        <div className="border rounded-lg divide-y">
                            {extractedCategories.map((mapping, index) => (
                                <div key={index} className="p-4 flex items-center gap-4">
                                    {/* Checkbox for scan selection */}
                                    <button
                                        onClick={() => toggleScanSelection(index)}
                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${mapping.selectedForScan
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : 'border-muted-foreground/30 hover:border-primary'
                                            }`}
                                    >
                                        {mapping.selectedForScan && <Check className="h-3 w-3" />}
                                    </button>

                                    {/* Category info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">
                                                {mapping.extractedCategory.name}
                                            </span>
                                            {mapping.extractedCategory.itemCount && (
                                                <span className="text-xs text-muted-foreground">
                                                    ({mapping.extractedCategory.itemCount} items)
                                                </span>
                                            )}
                                        </div>
                                        {mapping.extractedCategory.url && (
                                            <a
                                                href={mapping.extractedCategory.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                                            >
                                                {mapping.extractedCategory.url}
                                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Explore Depth Button */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleExploreDepth(index)}
                                        disabled={!mapping.extractedCategory.url || exploringIndex !== null}
                                        className="flex-shrink-0"
                                        title="Explore sub-categories"
                                    >
                                        {exploringIndex === index ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Search className="h-4 w-4" />
                                        )}
                                    </Button>

                                    {/* Category Mapping dropdown */}
                                    <div className="w-36">
                                        <Select
                                            value={mapping.mappedCategoryId || 'none'}
                                            onValueChange={(value) =>
                                                updateMapping(index, value === 'none' ? null : value)
                                            }
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Category..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    <span className="text-muted-foreground">No category</span>
                                                </SelectItem>
                                                <SelectItem value="__new__">
                                                    <span className="text-primary">+ Create new</span>
                                                </SelectItem>
                                                {categories.map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.id}>
                                                        {cat.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Collection Mapping dropdown */}
                                    <div className="w-36">
                                        <Select
                                            value={mapping.mappedCollectionId || 'none'}
                                            onValueChange={(value) =>
                                                updateCollectionMapping(index, value === 'none' ? null : value)
                                            }
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Collection..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    <span className="text-muted-foreground">No collection</span>
                                                </SelectItem>
                                                <SelectItem value="__new__">
                                                    <span className="text-primary">+ Create new</span>
                                                </SelectItem>
                                                {collections.map((col) => (
                                                    <SelectItem key={col.id} value={col.id}>
                                                        {col.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action buttons */}
                    {extractedCategories.length > 0 && (
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                disabled={selectedCount === 0}
                                onClick={handleStartScan}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                <Sparkles className="mr-2 h-4 w-4" />
                                Speed Scan {selectedCount} {selectedCount === 1 ? 'Category' : 'Categories'}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
