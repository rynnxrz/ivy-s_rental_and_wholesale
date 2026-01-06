'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { retrySystemError } from './actions'
import { toast } from 'sonner'

interface RetryButtonProps {
    errorId: string
    retryCount: number
    resolved: boolean
}

export function RetryButton({ errorId, retryCount, resolved }: RetryButtonProps) {
    const [isPending, startTransition] = useTransition()

    const handleRetry = () => {
        startTransition(() => {
            void (async () => {
                try {
                    const result = await retrySystemError(errorId)
                    if (result.error) {
                        toast.error(result.error)
                    } else {
                        toast.success(result.message)
                    }
                } catch (e) {
                    toast.error('Failed to retry action')
                }
            })()
        })
    }

    if (resolved) return null

    return (
        <Button
            size="sm"
            variant="outline"
            className="ml-auto flex items-center gap-2 h-8"
            onClick={handleRetry}
            disabled={isPending}
        >
            <RefreshCw className={`h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Retrying...' : `Retry (${retryCount || 0})`}
        </Button>
    )
}
