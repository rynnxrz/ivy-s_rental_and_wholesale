"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from "sonner"

export default function WholesalePage() {
    const router = useRouter()

    useEffect(() => {
        // Redirect to catalog with a wholesale mode query param or just show a message
        // For now, redirect to catalog and show a toast
        toast.info("Wholesale View: Coming Soon. Showing full catalog.")
        router.replace('/catalog?mode=wholesale')
    }, [router])

    return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-gray-900"></div>
        </div>
    )
}
