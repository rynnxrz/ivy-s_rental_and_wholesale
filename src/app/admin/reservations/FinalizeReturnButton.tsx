'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { finalizeReturn } from '../actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function FinalizeReturnButton({ reservationId }: { reservationId: string }) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleFinalize = () => {
        startTransition(() => {
            void (async () => {
                const result = await finalizeReturn(reservationId)

                if (result?.error) {
                    toast.error(result.error)
                } else {
                    toast.success('Reservation marked as returned')
                    router.refresh()
                }
            })()
        })
    }

    return (
        <Button
            type="button"
            onClick={handleFinalize}
            disabled={isPending}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 shadow-sm transition-all"
        >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? 'Completing...' : 'Complete Return & Close Order'}
        </Button>
    )
}
