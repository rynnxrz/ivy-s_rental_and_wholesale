'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, Globe, Loader2, Package, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type {
    GuidedImportIssue,
    GuidedImportRun,
    GuidedImportSection,
    ItemLineType,
    StagingImportEvent,
} from '@/types'
import { OFFICIAL_CHARACTERS } from '@/lib/items/catalog-rules'
import {
    answerImportQuestionsAction,
    getImportRunEventsAction,
    importPdfCatalogAction,
    runWebsiteMatchAction,
} from '@/actions/items'
import { StagingItemsList } from './StagingItemsList'

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
    collections: Collection[]
    onClose: () => void
}

const STEPS = [
    'Upload PDFs',
    'Review What Was Found',
    'Answer Missing Questions',
    'Add Website Photos',
    'Check Import Draft',
    'Import to Inventory',
] as const

type StepKey = 'upload' | 'review' | 'questions' | 'website' | 'draft'

type ImportResultState = Awaited<ReturnType<typeof importPdfCatalogAction>>

const getCurrentStepIndex = (step: StepKey) => {
    switch (step) {
        case 'upload':
            return 0
        case 'review':
            return 1
        case 'questions':
            return 2
        case 'website':
            return 3
        case 'draft':
            return 4
        default:
            return 0
    }
}

const getIssueTone = (issue: GuidedImportIssue['type']) => {
    switch (issue) {
        case 'character':
            return 'Character needed'
        case 'jewelry_type':
            return 'Jewelry Type needed'
        case 'source_page':
            return 'Page number needed'
        case 'duplicate_sku':
            return 'SKU review'
        case 'website_match':
            return 'Website match missing'
        default:
            return 'Needs review'
    }
}

const buildSectionKey = (section: GuidedImportSection) => `${section.batchId}:${section.key}`

const buildQuestionAnswerValue = (value: string | undefined, fallback = '') => value?.trim() || fallback

function Stepper({ currentStep }: { currentStep: StepKey }) {
    const currentIndex = getCurrentStepIndex(currentStep)

    return (
        <div className="grid gap-2 md:grid-cols-6">
            {STEPS.map((label, index) => {
                const isActive = index === currentIndex
                const isComplete = index < currentIndex

                return (
                    <div
                        key={label}
                        className={`rounded-xl border px-3 py-3 text-sm transition-colors ${
                            isActive
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : isComplete
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-white text-slate-500'
                        }`}
                    >
                        <div className="text-[11px] uppercase tracking-wide opacity-70">Step {index + 1}</div>
                        <div className="mt-1 font-medium">{label}</div>
                    </div>
                )
            })}
        </div>
    )
}

function ImportProgressPanel({
    runs,
    selectedRunId,
    onSelectRunId,
    eventMap,
}: {
    runs: GuidedImportRun[]
    selectedRunId: string | null
    onSelectRunId: (value: string) => void
    eventMap: Record<string, StagingImportEvent[]>
}) {
    const activeRunId = selectedRunId || runs[0]?.batchId || null
    const events = activeRunId ? (eventMap[activeRunId] || []) : []

    return (
        <div className="rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">Import Progress</h3>
                    <p className="text-xs text-slate-500">Saved progress for each import run.</p>
                </div>
                {runs.length > 1 && (
                    <Select value={activeRunId || undefined} onValueChange={onSelectRunId}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Choose import run" />
                        </SelectTrigger>
                        <SelectContent>
                            {runs.map((run) => (
                                <SelectItem key={run.batchId} value={run.batchId}>
                                    {run.sourceLabel}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <div className="max-h-[320px] space-y-2 overflow-y-auto p-4">
                {events.length === 0 ? (
                    <p className="text-sm text-slate-500">Progress will appear here after the PDF is read.</p>
                ) : (
                    events.map((event) => (
                        <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                                <span>{new Date(event.created_at).toLocaleTimeString()}</span>
                                <Badge variant="outline" className="h-5 border-slate-200 text-slate-600">
                                    {event.step.replace(/_/g, ' ')}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={`h-5 ${
                                        event.level === 'error'
                                            ? 'border-red-200 text-red-700 bg-red-50'
                                            : event.level === 'warning'
                                                ? 'border-amber-200 text-amber-700 bg-amber-50'
                                                : event.level === 'success'
                                                    ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                                    : 'border-slate-200 text-slate-600 bg-white'
                                    }`}
                                >
                                    {event.level}
                                </Badge>
                            </div>
                            <p className="mt-2 text-sm text-slate-700">{event.message}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export function AIImportPanel({ categories, collections, onClose }: AIImportPanelProps) {
    const [step, setStep] = useState<StepKey>('upload')
    const [defaultLineType, setDefaultLineType] = useState<ItemLineType>('Mainline')
    const [files, setFiles] = useState<File[]>([])
    const [importResult, setImportResult] = useState<ImportResultState | null>(null)
    const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({})
    const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({})
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [eventMap, setEventMap] = useState<Record<string, StagingImportEvent[]>>({})
    const [isPending, startTransition] = useTransition()

    const runs = useMemo(() => importResult?.runs || [], [importResult])
    const questions = useMemo(() => importResult?.questions || [], [importResult])
    const issues = useMemo(() => importResult?.issues || [], [importResult])
    const sections = useMemo(() => importResult?.sections || [], [importResult])
    const batchIds = useMemo(() => importResult?.batchIds || [], [importResult])
    const batchIdsKey = batchIds.join('|')

    const groupedSections = useMemo(() => {
        return runs.map(run => ({
            run,
            sections: sections.filter(section => section.batchId === run.batchId),
        })).filter(group => group.sections.length > 0)
    }, [runs, sections])

    const groupedQuestions = useMemo(() => {
        return runs.map(run => ({
            run,
            questions: questions.filter(question => question.batchId === run.batchId),
        })).filter(group => group.questions.length > 0)
    }, [runs, questions])

    const selectedIssueCount = useMemo(() => {
        return issues.filter(issue => {
            const matchedSection = sections.find(section => section.batchId === issue.batchId)
            if (!matchedSection) return true
            const key = buildSectionKey(matchedSection)
            return selectedSections[key] !== false
        }).length
    }, [issues, sections, selectedSections])

    useEffect(() => {
        if (batchIds.length === 0) return

        let isMounted = true
        const loadEvents = async () => {
            const results = await Promise.all(batchIds.map(batchId => getImportRunEventsAction(batchId)))
            if (!isMounted) return

            const nextMap: Record<string, StagingImportEvent[]> = {}
            results.forEach((result, index) => {
                nextMap[batchIds[index]] = result.events || []
            })
            setEventMap(nextMap)
        }

        void loadEvents()
        const interval = window.setInterval(() => {
            void loadEvents()
        }, 2500)

        return () => {
            isMounted = false
            window.clearInterval(interval)
        }
    }, [batchIds, batchIdsKey])

    const handleReadPdfFiles = () => {
        if (files.length === 0) {
            toast.error('Choose at least one PDF file.')
            return
        }

        startTransition(async () => {
            const formData = new FormData()
            files.forEach(file => formData.append('files', file))
            formData.append('defaultLineType', defaultLineType)

            const result = await importPdfCatalogAction(formData)
            if (result.batchIds.length > 0) {
                setImportResult(result)
                setSelectedRunId(result.batchIds[0] || null)
            }
            if (!result.success) {
                toast.error(result.error || 'Could not read the PDF files.')
                return
            }

            const initialSelections = result.sections.reduce<Record<string, boolean>>((acc, section) => {
                acc[buildSectionKey(section)] = true
                return acc
            }, {})

            setSelectedSections(initialSelections)
            setQuestionAnswers({})
            setStep('review')

            if (result.error) {
                toast.warning(result.error)
            } else {
                toast.success(`Read ${result.itemsFound} draft items from ${result.batchIds.length} PDF file${result.batchIds.length > 1 ? 's' : ''}.`)
            }
        })
    }

    const persistSectionSelections = async () => {
        if (!importResult) return true

        for (const run of importResult.runs) {
            const runSelections = Object.fromEntries(
                importResult.sections
                    .filter(section => section.batchId === run.batchId)
                    .map(section => [section.key, selectedSections[buildSectionKey(section)] !== false])
            )

            const result = await answerImportQuestionsAction({
                batchId: run.batchId,
                sectionSelections: runSelections,
            })

            if (!result.success) {
                toast.error(result.error || 'Could not save your section choices.')
                return false
            }
        }

        return true
    }

    const handleContinueFromReview = () => {
        startTransition(async () => {
            const saved = await persistSectionSelections()
            if (!saved) return
            setStep(questions.length > 0 ? 'questions' : 'website')
        })
    }

    const handleSaveAnswers = () => {
        if (!importResult) return

        const missingAnswer = questions.find(question => !buildQuestionAnswerValue(questionAnswers[question.id]))
        if (missingAnswer) {
            toast.error('Answer all remaining questions before continuing.')
            return
        }

        startTransition(async () => {
            for (const run of importResult.runs) {
                const answers = questions
                    .filter(question => question.batchId === run.batchId)
                    .map(question => ({
                        itemId: question.itemId,
                        type: question.type,
                        value: question.type === 'source_page'
                            ? Number(questionAnswers[question.id])
                            : questionAnswers[question.id],
                    }))

                const result = await answerImportQuestionsAction({
                    batchId: run.batchId,
                    answers,
                })

                if (!result.success) {
                    toast.error(result.error || 'Could not save your answers.')
                    return
                }
            }

            toast.success('Saved your import answers.')
            setStep('website')
        })
    }

    const handleWebsiteMatch = () => {
        if (!importResult) return

        startTransition(async () => {
            const result = await runWebsiteMatchAction(importResult.batchIds)
            if (!result.success) {
                toast.error(result.error || 'Could not add website photos.')
                return
            }

            toast.success(`Added website details for ${result.matchedCount}/${result.totalItems} draft items.`)
            setStep('draft')
        })
    }

    const importBatches = runs
        .filter((run) => run.itemsFound > 0)
        .map(run => ({
            id: run.batchId,
            source_url: null,
            source_label: run.sourceLabel,
            source_type: run.sourceType,
            status: 'completed',
            created_at: new Date().toISOString(),
            items_scraped: run.itemsFound,
            pending_count: run.itemsFound,
            default_line_type: run.defaultLineType,
        }))

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-slate-700" />
                        Guided Import
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Read PDF files, answer only what is missing, add website photos, then review the import draft.
                    </p>
                </div>
            </div>

            <Stepper currentStep={step} />

            {importResult && (
                <ImportProgressPanel
                    runs={runs}
                    selectedRunId={selectedRunId}
                    onSelectRunId={setSelectedRunId}
                    eventMap={eventMap}
                />
            )}

            {step === 'upload' && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="rounded-2xl border bg-white p-6 shadow-sm">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="pdf-files">PDF Files</Label>
                                <Input
                                    id="pdf-files"
                                    type="file"
                                    accept="application/pdf"
                                    multiple
                                    onChange={(event) => setFiles(Array.from(event.target.files || []))}
                                    disabled={isPending}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Upload one or more PDF files. Each file becomes its own import run, and you review them together later.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="default-line-type">Default Line Type</Label>
                                <Select value={defaultLineType} onValueChange={(value) => setDefaultLineType(value as ItemLineType)}>
                                    <SelectTrigger id="default-line-type" className="w-full md:w-[240px]">
                                        <SelectValue placeholder="Choose line type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Mainline">Mainline</SelectItem>
                                        <SelectItem value="Collaboration">Collaboration</SelectItem>
                                        <SelectItem value="Archive">Archive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {files.length > 0 && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-medium text-slate-900">Files ready to read</p>
                                    <div className="mt-3 space-y-2">
                                        {files.map((file) => (
                                            <div key={`${file.name}-${file.size}`} className="flex items-center justify-between text-sm text-slate-600">
                                                <span className="truncate">{file.name}</span>
                                                <span>{Math.round(file.size / 1024)} KB</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900">What this flow does</h3>
                        <ul className="mt-3 space-y-3 text-sm text-slate-600">
                            <li>Reads every sellable PDF item into an import draft.</li>
                            <li>Finds missing Character, Jewelry Type, or page details.</li>
                            <li>Adds public website photos and links from ivyjstudio.com.</li>
                            <li>Leaves final inventory import as a manual approval step.</li>
                        </ul>
                    </div>
                </div>
            )}

            {step === 'review' && importResult && (
                <div className="space-y-6">
                    <div className="rounded-2xl border bg-white p-6 shadow-sm">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="outline" className="border-slate-200 text-slate-700">
                                {importResult.itemsFound} draft items
                            </Badge>
                            <Badge variant="outline" className="border-slate-200 text-slate-700">
                                {importResult.batchIds.length} import run{importResult.batchIds.length > 1 ? 's' : ''}
                            </Badge>
                            {selectedIssueCount > 0 && (
                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                    {selectedIssueCount} items need answers
                                </Badge>
                            )}
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                            Confirm which PDF sections should be included. Sections are enabled by default.
                        </p>
                    </div>

                    {groupedSections.map(({ run, sections: runSections }) => (
                        <div key={run.batchId} className="rounded-2xl border bg-white p-6 shadow-sm">
                            <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-slate-500" />
                                <h3 className="text-base font-semibold text-slate-900">{run.sourceLabel}</h3>
                                <Badge variant="outline">{run.itemsFound} items</Badge>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {runSections.map((section) => {
                                    const key = buildSectionKey(section)
                                    const selected = selectedSections[key] !== false

                                    return (
                                        <button
                                            type="button"
                                            key={key}
                                            onClick={() => setSelectedSections(prev => ({ ...prev, [key]: !selected }))}
                                            className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                                                selected
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-slate-200 bg-white text-slate-600'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{section.title}</span>
                                                <span className="text-xs uppercase tracking-wide opacity-70">
                                                    {selected ? 'Included' : 'Skipped'}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-sm opacity-80">{section.itemCount} item{section.itemCount > 1 ? 's' : ''}</div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {step === 'questions' && importResult && (
                <div className="space-y-6">
                    {groupedQuestions.length === 0 ? (
                        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
                            No questions remain. Continue to add website photos.
                        </div>
                    ) : (
                        groupedQuestions.map(({ run, questions: runQuestions }) => (
                            <div key={run.batchId} className="rounded-2xl border bg-white p-6 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <Package className="h-4 w-4 text-slate-500" />
                                    <h3 className="text-base font-semibold text-slate-900">{run.sourceLabel}</h3>
                                </div>

                                <div className="mt-4 space-y-4">
                                    {runQuestions.map((question) => (
                                        <div key={question.id} className="rounded-xl border border-slate-200 p-4">
                                            <p className="text-sm font-medium text-slate-900">{question.prompt}</p>
                                            <p className="mt-1 text-xs text-slate-500">{getIssueTone(question.type)}</p>

                                            <div className="mt-3">
                                                {question.type === 'character' && (
                                                    <Select
                                                        value={questionAnswers[question.id] || undefined}
                                                        onValueChange={(value) => setQuestionAnswers(prev => ({ ...prev, [question.id]: value }))}
                                                    >
                                                        <SelectTrigger className="w-full md:w-[280px]">
                                                            <SelectValue placeholder="Choose Character" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {OFFICIAL_CHARACTERS.map((character) => (
                                                                <SelectItem key={character} value={character}>
                                                                    {character}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}

                                                {question.type === 'jewelry_type' && (
                                                    <Select
                                                        value={questionAnswers[question.id] || undefined}
                                                        onValueChange={(value) => setQuestionAnswers(prev => ({ ...prev, [question.id]: value }))}
                                                    >
                                                        <SelectTrigger className="w-full md:w-[280px]">
                                                            <SelectValue placeholder="Choose Jewelry Type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(question.options || []).map((option) => (
                                                                <SelectItem key={option} value={option}>
                                                                    {option}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}

                                                {question.type === 'source_page' && (
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={questionAnswers[question.id] || ''}
                                                        onChange={(event) => setQuestionAnswers(prev => ({ ...prev, [question.id]: event.target.value }))}
                                                        placeholder="Enter PDF page number"
                                                        className="w-full md:w-[220px]"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {step === 'website' && importResult && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="rounded-2xl border bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <Globe className="h-5 w-5 text-slate-700" />
                            <h3 className="text-base font-semibold text-slate-900">Add website photos and links</h3>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                            This step checks ivyjstudio.com and adds public product photos, URLs, and public-facing copy where a confident match exists.
                        </p>
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            PDF details stay in control. Website matching will only add photos, links, and public copy. It will never replace the PDF SKU, Character, Jewelry Type, source page, or price.
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900">Ready for website matching</h3>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {runs.map((run) => (
                                <div key={run.batchId} className="flex items-center justify-between">
                                    <span>{run.sourceLabel}</span>
                                    <span>{run.itemsFound} items</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {step === 'draft' && importResult && (
                <StagingItemsList
                    batches={importBatches}
                    categories={categories}
                    collections={collections}
                    onClose={onClose}
                />
            )}

            {step !== 'draft' && (
                <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>

                    <div className="flex items-center gap-2">
                        {step === 'upload' && (
                            <Button onClick={handleReadPdfFiles} disabled={isPending || files.length === 0}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Read PDF Files
                            </Button>
                        )}

                        {step === 'review' && (
                            <Button onClick={handleContinueFromReview} disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Continue
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}

                        {step === 'questions' && (
                            <Button onClick={handleSaveAnswers} disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Answers
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}

                        {step === 'website' && (
                            <>
                                <Button variant="outline" onClick={() => setStep('draft')} disabled={isPending}>
                                    Skip for now
                                </Button>
                                <Button onClick={handleWebsiteMatch} disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Website Photos
                                    <CheckCircle2 className="ml-2 h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
