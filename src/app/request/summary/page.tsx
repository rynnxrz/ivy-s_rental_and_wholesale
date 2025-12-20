import { Suspense } from 'react'
import { SummaryClient } from './SummaryClient' // Client component for summary logic

export const dynamic = 'force-dynamic'

export default function RequestSummaryPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-gray-900"></div>
            </div>
        }>
            <SummaryClient />
        </Suspense>
    )
}
