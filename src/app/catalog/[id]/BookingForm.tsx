"use client"

import * as React from "react"
import { addDays, format, parse } from "date-fns"
import { CalendarIcon, Loader2, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useRequestStore } from "@/store/request"
import { toast } from "sonner"

interface BookingFormProps {
    item: {
        id: string
        name: string
        category: string
        rental_price: number
        image_paths: string[] | null
        status: string
    }
}

export function BookingForm({ item }: BookingFormProps) {
    const [isChecking, setIsChecking] = React.useState(false)
    const [isAvailable, setIsAvailable] = React.useState<boolean | null>(null)
    const [isMounted, setIsMounted] = React.useState(false)

    const supabase = createClient()

    const [reservedDates, setReservedDates] = React.useState<{ from: Date; to: Date }[]>([])
    const [bufferDates, setBufferDates] = React.useState<{ from: Date; to: Date }[]>([])
    const [isMobileAvailabilityOpen, setIsMobileAvailabilityOpen] = React.useState(false)
    const [isDesktopAvailabilityOpen, setIsDesktopAvailabilityOpen] = React.useState(false)

    const { dateRange: globalDateRange, addItem, removeItem, hasItem } = useRequestStore()
    const hasGlobalDate = !!(globalDateRange.from && globalDateRange.to)

    // Parse global date range
    const parsedDateRange = React.useMemo(() => {
        if (!globalDateRange.from || !globalDateRange.to) return null
        return {
            from: parse(globalDateRange.from, 'yyyy-MM-dd', new Date()),
            to: parse(globalDateRange.to, 'yyyy-MM-dd', new Date())
        }
    }, [globalDateRange])

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    const handleAddToRequest = () => {
        if (!isAvailable) return
        addItem(item)
        toast.success("Item added to request list")
    }

    // Fetch unavailable dates and buffer on mount or when item changes
    React.useEffect(() => {
        async function fetchData() {
            let buffer = 1
            const { data: settings } = await supabase
                .from('app_settings')
                .select('turnaround_buffer')
                .single()

            if (settings?.turnaround_buffer !== undefined) {
                buffer = settings.turnaround_buffer
            }

            const { data, error } = await supabase
                .rpc('get_unavailable_date_ranges', { p_item_id: item.id })

            if (error) {
                console.error('Error fetching availability:', error)
                return
            }

            if (data) {
                const booked = data.map((r: { start_date: string; end_date: string }) => ({
                    from: new Date(r.start_date),
                    to: new Date(r.end_date)
                }))

                const buffers = data.map((r: { end_date: string }) => {
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

    // Check availability for global date range
    React.useEffect(() => {
        const checkAvailability = async () => {
            if (!parsedDateRange) {
                setIsAvailable(null)
                return
            }

            // Client-side quick check
            const allDisabled = [...reservedDates, ...bufferDates]
            const isBlockedData = allDisabled.some(disabled => {
                return (parsedDateRange.from <= disabled.to) && (parsedDateRange.to >= disabled.from)
            })

            if (isBlockedData) {
                setIsAvailable(false)
                return
            }

            setIsChecking(true)
            setIsAvailable(null)

            try {
                const { data, error } = await supabase.rpc('check_item_availability', {
                    p_item_id: item.id,
                    p_start_date: globalDateRange.from,
                    p_end_date: globalDateRange.to
                })

                if (error) {
                    console.error('Error checking availability:', error)
                    return
                }

                setIsAvailable(data)
            } finally {
                setIsChecking(false)
            }
        }

        if (hasGlobalDate) {
            const timeoutId = setTimeout(checkAvailability, 300)
            return () => clearTimeout(timeoutId)
        }
    }, [parsedDateRange, item.id, supabase, reservedDates, bufferDates, globalDateRange, hasGlobalDate])

    // If no global date, show "Select Dates First"
    if (!hasGlobalDate) {
        return (
            <div className="space-y-4">
                {/* Desktop */}
                <div className="hidden md:block">
                    <Link href="/catalog">
                        <Button
                            variant="outline"
                            className="w-full h-12 rounded-md text-sm border-slate-300 text-slate-600 hover:bg-slate-50"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Select Dates First
                        </Button>
                    </Link>
                </div>

                {/* Mobile sticky footer */}
                <div className="h-16 md:hidden" />
                <div
                    className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-50 md:hidden"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
                >
                    <Link href="/catalog">
                        <Button
                            variant="outline"
                            className="w-full h-12 rounded-md text-sm border-slate-300 text-slate-600"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Select Dates First
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    // Has global date - show availability and Add/Remove
    return (
        <div className="space-y-4">
            {/* Mobile: Date Display */}
            <div className="md:hidden">
                <div className="h-12 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50/50">
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-700" aria-hidden="true" />
                    <span className="text-sm text-slate-900">
                        {format(parsedDateRange!.from, "LLL dd")} - {format(parsedDateRange!.to, "LLL dd")}
                    </span>
                </div>
                {/* Availability status */}
                <div className="text-[11px] mt-1.5 pl-1" role="status" aria-live="polite" aria-atomic="true">
                    {isChecking ? (
                        <span className="text-slate-700 flex items-center gap-1 font-semibold">
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            Checking...
                        </span>
                    ) : isAvailable ? (
                        <span className="text-green-700 font-semibold">✓ Available</span>
                    ) : isAvailable === false ? (
                        <span className="text-red-700 font-semibold">✕ Not available for these dates</span>
                    ) : null}
                </div>
            </div>

            {/* Desktop: Date Display + Button */}
            <div className="hidden md:flex md:gap-3 md:items-start">
                {/* Date Display (Read-Only) - 65% */}
                <div className="flex-[0_0_65%]">
                    <div className="h-12 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50/50">
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-700" aria-hidden="true" />
                        <span className="text-sm text-slate-900">
                            {format(parsedDateRange!.from, "LLL dd")} - {format(parsedDateRange!.to, "LLL dd")}
                        </span>
                    </div>
                    {/* Availability status */}
                    <div className="text-[11px] mt-1.5 pl-1" role="status" aria-live="polite" aria-atomic="true">
                        {isChecking ? (
                            <span className="text-slate-700 flex items-center gap-1 font-semibold">
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                Checking...
                            </span>
                        ) : isAvailable ? (
                            <span className="text-green-700 font-semibold">✓ Available</span>
                        ) : isAvailable === false ? (
                            <span className="text-red-700 font-semibold">✕ Not available for these dates</span>
                        ) : null}
                    </div>
                </div>
                {/* Button - 35% */}
                <div className="flex-[0_0_35%]">
                    {isMounted && hasItem(item.id) ? (
                        <Button
                            variant="outline"
                            className="w-full h-12 rounded-md text-xs uppercase tracking-widest border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"
                            onClick={() => {
                                removeItem(item.id)
                                toast("Item removed from request list")
                            }}
                            aria-label={`Remove ${item.name} from your request list`}
                            aria-pressed="true"
                        >
                            ✕ Remove
                        </Button>
                    ) : (
                        <Button
                            className="w-full h-12 rounded-md text-xs uppercase tracking-widest focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"
                            disabled={!isAvailable}
                            onClick={handleAddToRequest}
                            aria-label={`Add ${item.name} to your request list`}
                            aria-pressed="false"
                        >
                            + Add to List
                        </Button>
                    )}
                </div>
            </div>

            {/* Mobile: View Availability Calendar Link (Read-Only) */}
            <div className="md:hidden">
                <Popover open={isMobileAvailabilityOpen} onOpenChange={setIsMobileAvailabilityOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            aria-expanded={isMobileAvailabilityOpen}
                            aria-controls="mobile-availability-popover"
                            className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-2 py-2 min-h-[44px] px-2 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none rounded-sm"
                        >
                            Check item availability calendar
                        </button>
                    </PopoverTrigger>
                    <PopoverContent id="mobile-availability-popover" className="w-auto p-0 rounded-md" align="start">
                        <Calendar
                            mode="range"
                            defaultMonth={parsedDateRange?.from}
                            selected={parsedDateRange || undefined}
                            numberOfMonths={1}
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
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Desktop: View Availability Calendar Link (Read-Only) */}
            <div className="hidden md:block">
                <Popover open={isDesktopAvailabilityOpen} onOpenChange={setIsDesktopAvailabilityOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            aria-expanded={isDesktopAvailabilityOpen}
                            aria-controls="desktop-availability-popover"
                            className="text-sm text-slate-700 hover:text-slate-900 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none rounded-sm min-h-[44px] px-2"
                        >
                            Check item availability calendar
                        </button>
                    </PopoverTrigger>
                    <PopoverContent id="desktop-availability-popover" className="w-auto p-0 rounded-md" align="start">
                        <Calendar
                            mode="range"
                            defaultMonth={parsedDateRange?.from}
                            selected={parsedDateRange || undefined}
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
                            footer={
                                <div className="flex gap-4 mt-2 text-xs text-gray-700 justify-center">
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 line-through text-gray-700 text-[10px] flex items-center justify-center">12</div> Booked</div>
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-100 text-gray-700 text-[10px] flex items-center justify-center">13</div> Buffer</div>
                                </div>
                            }
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Mobile: Sticky Footer */}
            <div
                className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-50 md:hidden"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
            >
                {isMounted && hasItem(item.id) ? (
                    <Button
                        variant="outline"
                        className="w-full h-12 rounded-md uppercase tracking-widest text-sm border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"
                        onClick={() => {
                            removeItem(item.id)
                            toast("Item removed from request list")
                        }}
                        aria-label={`Remove ${item.name} from your request list`}
                    >
                        ✕ Remove from List
                    </Button>
                ) : (
                    <Button
                        className="w-full h-12 rounded-md uppercase tracking-widest text-sm shadow-lg focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"
                        disabled={!isAvailable}
                        onClick={handleAddToRequest}
                        aria-label={`Add ${item.name} to your request list`}
                    >
                        Add to Request List
                    </Button>
                )}
            </div>
        </div>
    )
}
