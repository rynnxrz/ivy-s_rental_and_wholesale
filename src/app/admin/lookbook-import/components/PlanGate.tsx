'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Package,
  Loader2,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Edit3,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getLookbookSessionAction,
  updateLookbookItemAction,
  bulkUpdateLookbookItemsAction,
  commitLookbookImportAction,
} from '@/actions/lookbook-import'
import type { LookbookSessionData } from '@/actions/lookbook-import'
import type { LookbookImportItem, ValidationIssue } from '@/lib/lookbook-import/types'
import { EventLog } from './EventLog'

interface Props {
  sessionId: string
  categories: Array<{ id: string; name: string }>
  collections: Array<{ id: string; name: string }>
}

export function PlanGate({ sessionId, categories, collections }: Props) {
  const [data, setData] = useState<LookbookSessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set())
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [showEventLog, setShowEventLog] = useState(false)

  // Load session data
  useEffect(() => {
    loadSession()
  }, [sessionId])

  const loadSession = async () => {
    setLoading(true)
    try {
      const result = await getLookbookSessionAction(sessionId)
      setData(result)
      // Auto-expand all series
      const seriesNames = new Set(result.items.map(i => i.series_name))
      setExpandedSeries(seriesNames)
    } catch {
      toast.error('Failed to load session')
    } finally {
      setLoading(false)
    }
  }

  // Group items by series
  const itemsBySeries = data?.items.reduce<Record<string, LookbookImportItem[]>>((acc, item) => {
    const key = item.series_name || 'Uncategorized'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {}) || {}

  const toggleSeries = (name: string) => {
    setExpandedSeries(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleItemAction = (itemId: string, status: 'confirmed' | 'skipped') => {
    startTransition(async () => {
      const overrides = editingItem === itemId ? parseEditValues() : undefined
      const result = await updateLookbookItemAction({ itemId, status, overrides })
      if (result.success) {
        await loadSession()
        setEditingItem(null)
        setEditValues({})
      } else {
        toast.error(result.error || 'Failed to update item')
      }
    })
  }

  const handleBulkAction = (action: 'confirm_all' | 'skip_all' | 'confirm_series' | 'skip_series', seriesName?: string) => {
    startTransition(async () => {
      const result = await bulkUpdateLookbookItemsAction({
        sessionId,
        action,
        seriesName,
      })
      if (result.success) {
        toast.success(`Updated ${result.updatedCount} items`)
        await loadSession()
      } else {
        toast.error(result.error || 'Failed to update items')
      }
    })
  }

  const handleCommit = () => {
    startTransition(async () => {
      const result = await commitLookbookImportAction(sessionId)
      if (result.success) {
        toast.success(`Successfully imported ${result.importedCount} items to inventory!`)
        await loadSession()
      } else {
        toast.error(result.error || 'Failed to commit import')
      }
    })
  }

  const startEditing = (item: LookbookImportItem) => {
    setEditingItem(item.id)
    setEditValues({
      name: item.name,
      sku: item.sku || '',
      material: item.material || '',
      color: item.color || '',
      rrp: item.rrp?.toString() || '',
      weight: item.weight || '',
      size: item.size || '',
    })
  }

  const parseEditValues = (): Record<string, unknown> => {
    const overrides: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(editValues)) {
      if (value.trim()) {
        overrides[key] = key === 'rrp' ? parseFloat(value) : value
      }
    }
    return overrides
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-muted-foreground">Loading import session...</span>
      </div>
    )
  }

  if (!data?.session) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Session not found.
      </div>
    )
  }

  const session = data.session
  const pendingCount = data.items.filter(i => i.status === 'pending').length
  const confirmedCount = data.items.filter(i => i.status === 'confirmed').length
  const skippedCount = data.items.filter(i => i.status === 'skipped').length
  const importedCount = data.items.filter(i => i.status === 'imported').length

  return (
    <div className="space-y-6">
      {/* Session Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{session.source_file_name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {session.page_count} pages &middot; {data.items.length} items extracted &middot;{' '}
                {Object.keys(itemsBySeries).length} series
              </p>
            </div>
            <Badge className={`${session.status === 'awaiting_review' ? 'bg-orange-100 text-orange-800' : session.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
              {session.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
              <div className="text-xs text-yellow-600">Pending Review</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{confirmedCount}</div>
              <div className="text-xs text-green-600">Confirmed</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">{skippedCount}</div>
              <div className="text-xs text-gray-600">Skipped</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{importedCount}</div>
              <div className="text-xs text-blue-600">Imported</div>
            </div>
          </div>

          {/* Validation Summary */}
          {session.validation_summary && session.validation_summary.issues?.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  {session.validation_summary.warnings} warnings, {session.validation_summary.errors} errors
                </span>
              </div>
              <p className="text-xs text-amber-700">
                Review items below and correct any issues before confirming.
              </p>
            </div>
          )}

          {/* Bulk Actions */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('confirm_all')}
                disabled={isPending}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Confirm All ({pendingCount})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('skip_all')}
                disabled={isPending}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Skip All
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEventLog(!showEventLog)}
              >
                {showEventLog ? 'Hide' : 'Show'} Event Log
              </Button>
            </div>
          )}

          {/* Commit Button */}
          {confirmedCount > 0 && pendingCount === 0 && session.status !== 'completed' && (
            <Button
              onClick={handleCommit}
              disabled={isPending}
              className="w-full mt-4 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Import {confirmedCount} Items to Inventory
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Event Log (collapsible) */}
      {showEventLog && <EventLog events={data.events} />}

      {/* Series Groups */}
      {Object.entries(itemsBySeries).map(([seriesName, items]) => {
        const isExpanded = expandedSeries.has(seriesName)
        const seriesPending = items.filter(i => i.status === 'pending').length
        const seriesConfirmed = items.filter(i => i.status === 'confirmed').length

        return (
          <Card key={seriesName}>
            <CardHeader className="cursor-pointer" onClick={() => toggleSeries(seriesName)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">{seriesName}</CardTitle>
                  <Badge variant="secondary">{items.length} items</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {seriesPending > 0 && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleBulkAction('confirm_series', seriesName) }}
                        disabled={isPending}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Confirm Series
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleBulkAction('skip_series', seriesName) }}
                        disabled={isPending}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Skip Series
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent>
                <div className="space-y-3">
                  {items.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isEditing={editingItem === item.id}
                      editValues={editValues}
                      isPending={isPending}
                      onConfirm={() => handleItemAction(item.id, 'confirmed')}
                      onSkip={() => handleItemAction(item.id, 'skipped')}
                      onStartEdit={() => startEditing(item)}
                      onCancelEdit={() => { setEditingItem(null); setEditValues({}) }}
                      onEditChange={(key, value) => setEditValues(prev => ({ ...prev, [key]: value }))}
                    />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// --- Item Row Component ---

function ItemRow({
  item,
  isEditing,
  editValues,
  isPending,
  onConfirm,
  onSkip,
  onStartEdit,
  onCancelEdit,
  onEditChange,
}: {
  item: LookbookImportItem
  isEditing: boolean
  editValues: Record<string, string>
  isPending: boolean
  onConfirm: () => void
  onSkip: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onEditChange: (key: string, value: string) => void
}) {
  const hasIssues = item.issues && item.issues.length > 0
  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    skipped: 'bg-gray-100 text-gray-600',
    imported: 'bg-blue-100 text-blue-800',
  }[item.status]

  return (
    <div className={`p-4 rounded-lg border ${hasIssues ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
      <div className="flex items-start gap-4">
        {/* Product Image */}
        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {item.cropped_image_url ? (
            <img
              src={item.cropped_image_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-400" />
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={editValues.name || ''}
                  onChange={e => onEditChange('name', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">SKU</Label>
                <Input
                  value={editValues.sku || ''}
                  onChange={e => onEditChange('sku', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Material</Label>
                <Input
                  value={editValues.material || ''}
                  onChange={e => onEditChange('material', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <Input
                  value={editValues.color || ''}
                  onChange={e => onEditChange('color', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">RRP</Label>
                <Input
                  value={editValues.rrp || ''}
                  onChange={e => onEditChange('rrp', e.target.value)}
                  className="h-8 text-sm"
                  type="number"
                />
              </div>
              <div>
                <Label className="text-xs">Weight</Label>
                <Input
                  value={editValues.weight || ''}
                  onChange={e => onEditChange('weight', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{item.name}</span>
                <Badge className={statusColor}>{item.status}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {item.sku && <span className="font-mono">{item.sku}</span>}
                {item.material && <span>{item.material}</span>}
                {item.color && <span>{item.color}</span>}
                {item.rrp != null && <span className="font-medium">&pound;{item.rrp}</span>}
                {item.source_page && <span>p.{item.source_page}</span>}
              </div>
            </>
          )}

          {/* Issues */}
          {hasIssues && !isEditing && (
            <div className="mt-2 space-y-1">
              {item.issues.map((issue: ValidationIssue, i: number) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <AlertTriangle className={`h-3 w-3 ${issue.severity === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
                  <span className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
                    {issue.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.status === 'pending' && (
            <>
              {isEditing ? (
                <>
                  <Button size="sm" variant="default" onClick={onConfirm} disabled={isPending}>
                    <Check className="h-3 w-3 mr-1" /> Save & Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={onStartEdit} disabled={isPending}>
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={onConfirm} disabled={isPending}>
                    <CheckCircle2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onSkip} disabled={isPending}>
                    <XCircle className="h-3 w-3" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
