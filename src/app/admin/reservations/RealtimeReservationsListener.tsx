'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function RealtimeReservationsListener() {
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const channel = supabase
            .channel('admin-reservations-insert')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'reservations',
                },
                (payload) => {
                    toast.info('New Reservation Received!', {
                        description: 'The list has been updated.',
                        duration: 5000,
                    })

                    // M3: Sound Effect
                    try {
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') // Simple Bell
                        audio.volume = 0.5
                        audio.play().catch(e => console.log('Audio play blocked:', e))
                    } catch (e) {
                        // Ignore audio errors
                    }

                    router.refresh()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [router, supabase])

    return null
}
