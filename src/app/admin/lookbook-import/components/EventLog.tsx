'use client'

import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LookbookEvent } from '@/lib/lookbook-import/types'

interface Props {
  events: LookbookEvent[]
}

const LEVEL_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
}

const LEVEL_COLORS = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
}

const STEP_LABELS: Record<string, string> = {
  upload: 'Upload',
  pdf_to_images: 'PDF Rendering',
  series_extraction: 'Series Detection',
  product_extraction: 'Product Extraction',
  validation: 'Validation',
  user_review: 'User Review',
  image_crop: 'Image Cropping',
  db_write: 'Database Write',
  commit: 'Commit to Inventory',
}

export function EventLog({ events }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline Event Log (DecisionID Trace)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {events.map(event => {
            const Icon = LEVEL_ICONS[event.level as keyof typeof LEVEL_ICONS] || Info
            const color = LEVEL_COLORS[event.level as keyof typeof LEVEL_COLORS] || 'text-gray-500'

            return (
              <div key={event.id} className="flex items-start gap-3 text-sm">
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {STEP_LABELS[event.step] || event.step}
                    </span>
                    {event.elapsed_ms != null && (
                      <span className="text-xs text-muted-foreground">
                        {event.elapsed_ms}ms
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">{event.message}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
