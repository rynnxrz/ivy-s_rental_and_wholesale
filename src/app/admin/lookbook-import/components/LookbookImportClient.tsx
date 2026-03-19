'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileText, Upload, Loader2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { importLookbookAction } from '@/actions/lookbook-import'
import type { LookbookImportResult } from '@/actions/lookbook-import'
import type { LookbookSession, SeriesPlan, ValidationSummary } from '@/lib/lookbook-import/types'
import { PlanGate } from './PlanGate'

interface Props {
  recentSessions: Array<{
    id: string
    source_file_name: string
    status: string
    page_count: number
    created_at: string
    series_plan: SeriesPlan[]
    validation_summary: ValidationSummary
  }>
  categories: Array<{ id: string; name: string }>
  collections: Array<{ id: string; name: string }>
}

const AI_PROVIDERS = [
  { value: 'qwen', label: 'Qwen (DashScope) — Free Tier' },
  { value: 'xiaomi', label: 'Xiaomi MiMo — Free Beta' },
  { value: 'gemini', label: 'Google Gemini' },
]

const STATUS_COLORS: Record<string, string> = {
  uploading: 'bg-blue-100 text-blue-800',
  analyzing: 'bg-purple-100 text-purple-800',
  extracting: 'bg-indigo-100 text-indigo-800',
  validating: 'bg-yellow-100 text-yellow-800',
  awaiting_review: 'bg-orange-100 text-orange-800',
  importing: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export function LookbookImportClient({ recentSessions, categories, collections }: Props) {
  const [isPending, startTransition] = useTransition()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [aiProvider, setAiProvider] = useState('qwen')
  const [lineType, setLineType] = useState('Mainline')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<LookbookImportResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
    } else {
      toast.error('Please select a PDF file')
    }
  }

  const handleUpload = () => {
    if (!selectedFile) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('aiProvider', aiProvider)
      formData.append('defaultLineType', lineType)

      try {
        const result = await importLookbookAction(formData)
        setImportResult(result)

        if (result.success && result.sessionId) {
          setActiveSessionId(result.sessionId)
          toast.success(
            `Extracted ${result.itemsExtracted} items from ${result.seriesPlan.length} series. Ready for review.`
          )
        } else {
          toast.error(result.error || 'Import failed')
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Import failed')
      }
    })
  }

  const handleSessionClick = (sessionId: string) => {
    setActiveSessionId(sessionId)
    setImportResult(null)
  }

  // If viewing a session's Plan Gate
  if (activeSessionId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveSessionId(null)
              setImportResult(null)
            }}
          >
            &larr; Back to Import
          </Button>
          <h1 className="text-2xl font-bold">Review Import Plan</h1>
        </div>
        <PlanGate
          sessionId={activeSessionId}
          categories={categories}
          collections={collections}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="h-8 w-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold">Lookbook Import</h1>
          <p className="text-sm text-muted-foreground">
            Upload a jewelry lookbook PDF. AI will extract series, products, and images automatically.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Lookbook PDF
              </CardTitle>
              <CardDescription>
                The AI pipeline will: identify series &rarr; extract products &rarr; validate data &rarr; present for your review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Input */}
              <div className="space-y-2">
                <Label htmlFor="pdf-file">PDF File</Label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="pdf-file"
                    className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                  >
                    <FileText className="h-6 w-6 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {selectedFile ? selectedFile.name : 'Click to select a PDF file'}
                    </span>
                    <input
                      id="pdf-file"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>

              {/* Settings Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>AI Provider</Label>
                  <Select value={aiProvider} onValueChange={setAiProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Line Type</Label>
                  <Select value={lineType} onValueChange={setLineType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mainline">Mainline</SelectItem>
                      <SelectItem value="Collaboration">Collaboration</SelectItem>
                      <SelectItem value="Archive">Archive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Upload Button */}
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isPending}
                className="w-full"
                size="lg"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing... (this may take a minute)
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start AI Import
                  </>
                )}
              </Button>

              {/* Result Summary */}
              {importResult && !importResult.success && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">Import Failed</p>
                  <p className="text-sm text-red-600 mt-1">{importResult.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sessions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Imports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No imports yet.</p>
              ) : (
                recentSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => handleSessionClick(session.id)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate max-w-[160px]">
                        {session.source_file_name}
                      </span>
                      <Badge className={`text-xs ${STATUS_COLORS[session.status] || 'bg-gray-100'}`}>
                        {session.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{session.page_count} pages</span>
                      <span>&middot;</span>
                      <span>{session.series_plan?.length || 0} series</span>
                      <span>&middot;</span>
                      <span>{new Date(session.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
