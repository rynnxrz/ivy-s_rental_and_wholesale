"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { DateRange } from "react-day-picker"
import { createClient } from "@/lib/supabase/client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface BookingFormProps {
    item: {
        id: string
        name: string
        rental_price: number
    }
}

export function BookingForm({ item }: BookingFormProps) {
    const [date, setDate] = React.useState<DateRange | undefined>()
    const [isChecking, setIsChecking] = React.useState(false)
    const [isAvailable, setIsAvailable] = React.useState<boolean | null>(null)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [message, setMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null)

    const supabase = createClient()

    const [reservedDates, setReservedDates] = React.useState<{ from: Date; to: Date }[]>([])
    const [bufferDates, setBufferDates] = React.useState<{ from: Date; to: Date }[]>([])

    // Fetch unavailable dates and buffer on mount or when item changes
    React.useEffect(() => {
        async function fetchData() {
            // 1. Fetch Buffer Setting
            let buffer = 1 // default
            const { data: settings } = await supabase
                .from('app_settings')
                .select('turnaround_buffer')
                .single()

            if (settings?.turnaround_buffer !== undefined) {
                buffer = settings.turnaround_buffer
            }

            // 2. Fetch Reservations
            const { data, error } = await supabase
                .from('reservations')
                .select('start_date, end_date')
                .eq('item_id', item.id)
                .in('status', ['confirmed', 'active'])

            if (error) {
                console.error('Error fetching availability:', error)
                return
            }

            if (data) {
                const booked = data.map((r: any) => ({
                    from: new Date(r.start_date),
                    to: new Date(r.end_date)
                }))

                const buffers = data.map((r: any) => {
                    const endDate = new Date(r.end_date)
                    return {
                        from: addDays(endDate, 1),
                        to: addDays(endDate, buffer)
                    }
                })

                setReservedDates(booked)
                setBufferDates(buffers)
            }
        }
        fetchData()
    }, [item.id, supabase])

    // Check availability checking logic (existing) - we can keep this for double safety
    // or rely on visual blocking. Usually, keeping server-side check is robust.
    React.useEffect(() => {
        const checkAvailability = async () => {
            // ... existing logic ...
            if (!date?.from || !date?.to) {
                setIsAvailable(null)
                return
            }

            // Client-side quick check against fetched disabled dates
            // If the selected range intersects any reserved OR buffer range, bail early
            const allDisabled = [...reservedDates, ...bufferDates]
            const isBlockedData = allDisabled.some(disabled => {
                if (!date.from || !date.to) return false
                // Check intersection: (StartA <= EndB) and (EndA >= StartB)
                return (date.from <= disabled.to) && (date.to >= disabled.from)
            })

            if (isBlockedData) {
                setIsAvailable(false)
                return
            }

            setIsChecking(true)
            setIsAvailable(null)
            setMessage(null)

            // Proceed to server check (handles race conditions, etc)
            const payload = {
                p_item_id: item.id,
                p_start_date: format(date.from, 'yyyy-MM-dd'),
                p_end_date: format(date.to, 'yyyy-MM-dd')
            }
            console.log('Checking availability with:', payload)

            try {
                const { data, error } = await supabase.rpc('check_item_availability', payload)

                if (error) {
                    console.error('Error checking availability:', JSON.stringify(error, null, 2))
                    return
                }

                setIsAvailable(data)
            } finally {
                setIsChecking(false)
            }
        }

        const timeoutId = setTimeout(() => {
            checkAvailability()
        }, 500) // Debounce

        return () => clearTimeout(timeoutId)
    }, [date, item.id, supabase, reservedDates, bufferDates])

    const handleRequestBooking = async () => {
        if (!date?.from || !date?.to || !isAvailable) return

        setIsSubmitting(true)
        setMessage(null)

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser()

            if (userError || !user) {
                setMessage({ type: 'error', text: 'You must be logged in to request a booking.' })
                return
            }

            const bookingPayload = {
                item_id: item.id,
                renter_id: user.id,
                start_date: format(date.from, 'yyyy-MM-dd'),
                end_date: format(date.to, 'yyyy-MM-dd'),
                status: 'pending'
            }
            console.log('Submitting booking:', bookingPayload)

            const { error } = await supabase
                .from('reservations')
                .insert(bookingPayload)

            if (error) {
                console.error('Booking error:', JSON.stringify(error, null, 2))
                setMessage({ type: 'error', text: 'Failed to submit request. Please try again.' })
            } else {
                setMessage({ type: 'success', text: 'Request submitted successfully! We will contact you shortly.' })
                setDate(undefined)
                setIsAvailable(null)
            }
        } catch (err) {
            console.error(err)
            setMessage({ type: 'error', text: 'An unexpected error occurred.' })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
                    Select Dates
                </h3>
                <div className={cn("grid gap-2")}>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal h-12",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "LLL dd, y")} -{" "}
                                            {format(date.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(date.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Pick a date range</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                                disabled={[
                                    ...reservedDates,
                                    ...bufferDates,
                                    { before: new Date(new Date().setHours(0, 0, 0, 0)) }
                                ]}
                                modifiers={{
                                    booked: reservedDates,
                                    buffer: bufferDates
                                }}
                                modifiersStyles={{
                                    booked: { textDecoration: 'line-through', color: '#888', opacity: 0.8 },
                                    buffer: { backgroundColor: '#f3f4f6', color: '#9ca3af', textDecoration: 'none', cursor: 'not-allowed' }
                                }}
                                modifiersClassNames={{
                                    buffer: 'cursor-not-allowed group relative' // We might try CSS tooltips if we can inject global styles, but simple style is safer
                                }}
                                footer={
                                    <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 line-through text-gray-400 text-[10px] flex items-center justify-center">12</div> Booked</div>
                                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-100 text-gray-400 text-[10px] flex items-center justify-center">13</div> Buffer</div>
                                    </div>
                                }
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Availability Status */}
            {date?.from && date?.to && (
                <div className={cn(
                    "p-4 rounded-sm text-sm border",
                    isChecking ? "bg-gray-50 border-gray-200 text-gray-500" :
                        isAvailable ? "bg-green-50 border-green-200 text-green-700" :
                            "bg-red-50 border-red-200 text-red-700"
                )}>
                    {isChecking ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Checking availability...
                        </div>
                    ) : isAvailable ? (
                        "Dates are available!"
                    ) : (
                        "Dates are not available."
                    )}
                </div>
            )}

            <Button
                className="w-full h-12 uppercase tracking-widest text-sm"
                disabled={!isAvailable || isSubmitting || !date?.from || !date?.to}
                onClick={handleRequestBooking}
            >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Submitting...' : 'Request Booking'}
            </Button>

            {message && (
                <div className={cn(
                    "p-4 rounded-sm text-sm text-center",
                    message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                    {message.text}
                </div>
            )}
        </div>
    )
}
