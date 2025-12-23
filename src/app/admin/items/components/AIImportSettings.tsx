'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, RotateCcw, Copy, Check, Send, Trash2, MessageSquare, Bot, User } from 'lucide-react'
import { toast } from 'sonner'
import { AvailableModel, getDefaultPromptsAction, testAIChatAction, getModelThinkingLevelsAction } from '@/actions/items'
import { saveAISettingsAction, restoreDefaultAISettingsAction } from '@/app/admin/settings/actions'

interface AIImportSettingsProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    availableModels: AvailableModel[]
    initialSettings: {
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
    }
}

export function AIImportSettings({
    open,
    onOpenChange,
    availableModels,
    initialSettings
}: AIImportSettingsProps) {
    const [selectedModel, setSelectedModel] = useState(initialSettings.selectedModel || 'gemini-2.0-flash')
    const [prompts, setPrompts] = useState({
        category: initialSettings.promptCategory || '',
        subcategory: initialSettings.promptSubcategory || '',
        productList: initialSettings.promptQuickList || initialSettings.promptProductList || '',
        quickList: initialSettings.promptQuickList || initialSettings.promptProductList || '',
        productDetail: initialSettings.promptProductDetail || ''
    })
    const [thinkingLevels, setThinkingLevels] = useState({
        category: initialSettings.thinkingCategory || '',
        subcategory: initialSettings.thinkingSubcategory || '',
        productList: initialSettings.thinkingProductList || '',
        productDetail: initialSettings.thinkingProductDetail || ''
    })
    const [modelThinkingOptions, setModelThinkingOptions] = useState<string[]>([])
    const [isLoadingThinking, setIsLoadingThinking] = useState(false)
    const [isSaving, startTransition] = useTransition()
    const [defaultPrompts, setDefaultPrompts] = useState<{
        category: string
        subcategory: string
        productList: string
        quickList: string
        productDetail: string
    } | null>(null)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)

    // Chat testing state
    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
    const [chatInput, setChatInput] = useState('')
    const [isChatting, setIsChatting] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when new messages appear
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    const handleSendChat = async () => {
        if (!chatInput.trim() || isChatting) return

        const userMessage = chatInput.trim()
        setChatInput('')

        // Add user message to display
        const newUserMessage = { role: 'user' as const, content: userMessage }
        setChatMessages(prev => [...prev, newUserMessage])
        setIsChatting(true)

        // Pass conversation history to server action for context
        const result = await testAIChatAction(userMessage, selectedModel, chatMessages)

        if (result.success) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: result.response }])
        } else {
            setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${result.error}` }])
            toast.error(result.error || 'Failed to get response')
        }

        setIsChatting(false)
    }

    const handleClearChat = () => {
        setChatMessages([])
        setChatInput('')
    }

    // Note: local state is initialized from initialSettings once. If the parent updates
    // initialSettings later, we intentionally keep the user's in-progress edits intact.

    // Load default prompts when opened
    useEffect(() => {
        if (open && !defaultPrompts) {
            getDefaultPromptsAction().then(setDefaultPrompts)
        }
    }, [open, defaultPrompts])

    useEffect(() => {
        const fetchThinking = async () => {
            if (!open) return
            setIsLoadingThinking(true)
            setModelThinkingOptions([])
            const result = await getModelThinkingLevelsAction(selectedModel)
            if (result.success) {
                setModelThinkingOptions(result.levels)
            } else {
                setModelThinkingOptions(result.levels || [])
            }
            setIsLoadingThinking(false)
        }
        fetchThinking()
    }, [open, selectedModel])

    const handleSave = () => {
        startTransition(async () => {
            const result = await saveAISettingsAction({
                ai_selected_model: selectedModel,
                ai_prompt_category: prompts.category || null,
                ai_prompt_subcategory: prompts.subcategory || null,
                // Product list prompt is deprecated; reuse speed-scan prompt for backward compatibility
                ai_prompt_product_list: prompts.quickList || null,
                ai_prompt_quick_list: prompts.quickList || null,
                ai_prompt_product_detail: prompts.productDetail || null,
                ai_thinking_category: thinkingLevels.category || null,
                ai_thinking_subcategory: thinkingLevels.subcategory || null,
                ai_thinking_product_list: thinkingLevels.productList || null,
                ai_thinking_product_detail: thinkingLevels.productDetail || null
            })

            if (result.success) {
                toast.success('AI Settings saved')
                onOpenChange(false)
            } else {
                toast.error(result.error || 'Failed to save settings')
            }
        })
    }

    const handleRestoreDefault = (key: keyof typeof prompts) => {
        setPrompts(prev => ({ ...prev, [key]: '' }))
        toast.info('Cleared. Save to use system default.')
    }

    const handleCopyDefault = (text: string, key: string) => {
        navigator.clipboard.writeText(text)
        setCopiedKey(key)
        toast.success('Default prompt copied to clipboard')
        setTimeout(() => setCopiedKey(null), 2000)
    }

    const renderDefaultPrompt = (key: string, text: string) => (
        <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground border">
            <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground/80">Default Prompt Preview</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => handleCopyDefault(text, key)}
                >
                    {copiedKey === key ? (
                        <Check className="mr-1 h-3 w-3 text-green-500" />
                    ) : (
                        <Copy className="mr-1 h-3 w-3" />
                    )}
                    Copy
                </Button>
            </div>
            <pre className="whitespace-pre-wrap font-mono overflow-auto max-h-[150px]">{text}</pre>
        </div>
    )

    const renderThinkingSelector = (
        key: keyof typeof thinkingLevels,
        label: string
    ) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>{label}</Label>
                {isLoadingThinking && <span className="text-xs text-muted-foreground">Loading...</span>}
            </div>
            <Select
                value={thinkingLevels[key] || '__default'}
                onValueChange={(value) =>
                    setThinkingLevels(prev => ({ ...prev, [key]: value === '__default' ? '' : value }))
                }
                disabled={isLoadingThinking || modelThinkingOptions.length === 0}
            >
                <SelectTrigger>
                    <SelectValue placeholder={modelThinkingOptions.length === 0 ? 'Model did not expose levels' : 'Use model default'} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__default">
                        Use model default
                    </SelectItem>
                    {modelThinkingOptions.map(level => (
                        <SelectItem key={level} value={level}>
                            {level}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
                {modelThinkingOptions.length > 0
                    ? 'Options fetched from the selected model.'
                    : 'This model did not return explicit thinking levels from the API.'}
            </p>
        </div>
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] md:w-[92vw] max-w-6xl md:max-w-7xl h-[92vh] md:h-[90vh] flex flex-col">
                <DialogHeader className="flex-none">
                    <DialogTitle>AI Configuration</DialogTitle>
                    <DialogDescription>
                        Configure the AI model and custom prompts for the import process.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0 w-full mt-4 gap-3">
                    <TabsList className="grid w-full grid-cols-4 flex-none">
                        <TabsTrigger value="general">Model</TabsTrigger>
                        <TabsTrigger value="extraction">Extraction</TabsTrigger>
                        <TabsTrigger value="products">Products</TabsTrigger>
                        <TabsTrigger value="detail">Details</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {/* General: Model Selection + Test Chat */}
                        <TabsContent value="general" className="py-4 h-full flex flex-col">
                            <div className="space-y-2 flex-none">
                                <Label>Selected AI Model</Label>
                                <Select value={selectedModel} onValueChange={setSelectedModel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableModels.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{model.displayName}</span>
                                                    {model.inputTokenLimit && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {Math.round(model.inputTokenLimit / 1000)}K context
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">
                                    Select the Google Gemini model to use for scraping. Newer models (2.0) are generally faster and more accurate.
                                </p>
                            </div>

                            {/* Test Chat Section */}
                            <div className="mt-6 flex-1 flex flex-col min-h-0">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-purple-500" />
                                        <Label className="text-sm font-medium">Test Chat</Label>
                                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                                            {selectedModel}
                                        </span>
                                    </div>
                                    {chatMessages.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                            onClick={handleClearChat}
                                        >
                                            <Trash2 className="mr-1 h-3 w-3" />
                                            Clear
                                        </Button>
                                    )}
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 min-h-[240px] overflow-y-auto border rounded-lg bg-muted/30 p-3 space-y-3">
                                    {chatMessages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                                            <Bot className="h-8 w-8 mb-2 opacity-50" />
                                            <p>Send a message to test the model</p>
                                            <p className="text-xs mt-1">Try: &quot;What model are you?&quot;</p>
                                        </div>
                                    ) : (
                                        <>
                                            {chatMessages.map((msg, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    {msg.role === 'assistant' && (
                                                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                                            <Bot className="h-3.5 w-3.5 text-purple-600" />
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user'
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-background border'
                                                            }`}
                                                    >
                                                        <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                                                    </div>
                                                    {msg.role === 'user' && (
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                                            <User className="h-3.5 w-3.5 text-slate-600" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {isChatting && (
                                                <div className="flex gap-2 justify-start">
                                                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                                        <Bot className="h-3.5 w-3.5 text-purple-600" />
                                                    </div>
                                                    <div className="bg-background border rounded-lg px-3 py-2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </>
                                    )}
                                </div>

                                {/* Chat Input */}
                                <div className="mt-3 flex gap-2">
                                    <Input
                                        placeholder="Type a message to test the model..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendChat()
                                            }
                                        }}
                                        disabled={isChatting}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={handleSendChat}
                                        disabled={!chatInput.trim() || isChatting}
                                        size="icon"
                                        className="bg-purple-600 hover:bg-purple-700"
                                    >
                                        {isChatting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Extraction: Category & Subcategory Prompts */}
                        <TabsContent value="extraction" className="space-y-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                                <div className="space-y-2 flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <Label>Category Extraction Prompt</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-xs"
                                            onClick={() => handleRestoreDefault('category')}
                                        >
                                            <RotateCcw className="mr-1 h-3 w-3" />
                                            Restore Default
                                        </Button>
                                    </div>
                                    <Textarea
                                        placeholder="System default (Leave empty to use default)"
                                        value={prompts.category}
                                        onChange={(e) => setPrompts(p => ({ ...p, category: e.target.value }))}
                                        className="flex-1 min-h-[250px] font-mono text-xs"
                                    />
                                    {renderThinkingSelector('category', 'Thinking level for category extraction')}
                                </div>
                                <div className="space-y-2 pt-8">
                                    {defaultPrompts && renderDefaultPrompt('category', defaultPrompts.category)}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div className="space-y-2 flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <Label>Sub-Category Exploration Prompt</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-xs"
                                            onClick={() => handleRestoreDefault('subcategory')}
                                        >
                                            <RotateCcw className="mr-1 h-3 w-3" />
                                            Restore Default
                                        </Button>
                                    </div>
                                    <Textarea
                                        placeholder="System default (Leave empty to use default)"
                                        value={prompts.subcategory}
                                        onChange={(e) => setPrompts(p => ({ ...p, subcategory: e.target.value }))}
                                        className="flex-1 min-h-[200px] font-mono text-xs"
                                    />
                                    {renderThinkingSelector('subcategory', 'Thinking level for sub-category exploration')}
                                </div>
                                <div className="space-y-2 pt-8">
                                    {defaultPrompts && renderDefaultPrompt('subcategory', defaultPrompts.subcategory)}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Products: Speed Scan Prompt */}
                        <TabsContent value="products" className="space-y-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div className="space-y-2 flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <Label>Speed Scan Prompt (Listing only)</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-xs"
                                            onClick={() => handleRestoreDefault('quickList')}
                                        >
                                            <RotateCcw className="mr-1 h-3 w-3" />
                                            Restore Default
                                        </Button>
                                    </div>
                                    <Textarea
                                        placeholder="System default (Leave empty to use default)"
                                        value={prompts.quickList}
                                        onChange={(e) => setPrompts(p => ({ ...p, quickList: e.target.value }))}
                                        className="flex-1 min-h-[260px] font-mono text-xs"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Used for the Speed Scan (listing-only) step. AI visits the listing page and returns products with URLs, prices, thumbnails, colors.
                                    </p>
                                </div>
                                <div className="space-y-2 pt-8">
                                    {defaultPrompts && renderDefaultPrompt('quickList', defaultPrompts.quickList)}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Detail: Product Parsing */}
                        <TabsContent value="detail" className="space-y-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                                <div className="space-y-2 flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <Label>Product Detail Parsing Prompt</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-xs"
                                            onClick={() => handleRestoreDefault('productDetail')}
                                        >
                                            <RotateCcw className="mr-1 h-3 w-3" />
                                            Restore Default
                                        </Button>
                                    </div>
                                    <Textarea
                                        placeholder="System default (Leave empty to use default)"
                                        value={prompts.productDetail}
                                        onChange={(e) => setPrompts(p => ({ ...p, productDetail: e.target.value }))}
                                        className="flex-1 min-h-[400px] font-mono text-xs"
                                    />
                                    {renderThinkingSelector('productDetail', 'Thinking level for detail parsing')}
                                </div>
                                <div className="space-y-2 pt-8">
                                    {defaultPrompts && renderDefaultPrompt('productDetail', defaultPrompts.productDetail)}
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <DialogFooter className="flex-none pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
