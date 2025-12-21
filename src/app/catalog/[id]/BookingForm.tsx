"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { DateRange } from "react-day-picker"
import { createClient } from "@/lib/supabase/client"
import { createGuestBooking } from "@/actions/booking"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useRequestStore } from "@/store/request"
import { toast } from "sonner"
import { parse } from "date-fns"

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
    const [date, setDate] = React.useState<DateRange | undefined>()
    const [isChecking, setIsChecking] = React.useState(false)
    const [isAvailable, setIsAvailable] = React.useState<boolean | null>(null)
    const [isSubmitting, startSubmitTransition] = React.useTransition()
    const [message, setMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Guest form fields
    const [email, setEmail] = React.useState('')
    const [fullName, setFullName] = React.useState('')
    const [companyName, setCompanyName] = React.useState('')
    const [accessPassword, setAccessPassword] = React.useState('')

    const supabase = createClient()

    const [reservedDates, setReservedDates] = React.useState<{ from: Date; to: Date }[]>([])
    const [bufferDates, setBufferDates] = React.useState<{ from: Date; to: Date }[]>([])

    const { dateRange: globalDateRange, addItem, hasItem } = useRequestStore()
    const isGlobalDateMode = !!(globalDateRange.from && globalDateRange.to)
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    // Initial date set from global store (only once)
    React.useEffect(() => {
        if (globalDateRange.from && globalDateRange.to && !date) {
            setDate({
                from: parse(globalDateRange.from, 'yyyy-MM-dd', new Date()),
                to: parse(globalDateRange.to, 'yyyy-MM-dd', new Date())
            })
        }
    }, [globalDateRange, date])

    const handleAddToRequest = () => {
        if (!isAvailable) return

        addItem(item)
        toast.success("Item added to request list")
    }

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

            // 2. Fetch Unavailable Date Ranges via RPC (bypasses RLS)
            const { data, error } = await supabase
                .rpc('get_unavailable_date_ranges', { p_item_id: item.id })

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

    // Check availability logic
    React.useEffect(() => {
        const checkAvailability = async () => {
            if (!date?.from || !date?.to) {
                setIsAvailable(null)
                return
            }

            // Client-side quick check against fetched disabled dates
            const allDisabled = [...reservedDates, ...bufferDates]
            const isBlockedData = allDisabled.some(disabled => {
                if (!date.from || !date.to) return false
                return (date.from <= disabled.to) && (date.to >= disabled.from)
            })

            if (isBlockedData) {
                setIsAvailable(false)
                return
            }

            setIsChecking(true)
            setIsAvailable(null)
            setMessage(null)

            const payload = {
                p_item_id: item.id,
                p_start_date: format(date.from, 'yyyy-MM-dd'),
                p_end_date: format(date.to, 'yyyy-MM-dd')
            }

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

        // If in global date mode, this button acts as "Add to List" (though UI changes, logic double check)
        // actually we will render different buttons.

        if (!email.trim() || !fullName.trim()) {
            setMessage({ type: 'error', text: 'Please fill in your email and name.' })
            return
        }

        setMessage(null)

        startSubmitTransition(() => {
            void (async () => {
                try {
                    const result = await createGuestBooking({
                        item_id: item.id,
                        email: email.trim(),
                        full_name: fullName.trim(),
                        company_name: companyName.trim() || undefined,
                        start_date: format(date.from!, 'yyyy-MM-dd'),
                        end_date: format(date.to!, 'yyyy-MM-dd'),
                        access_password: accessPassword.trim() || undefined
                    })

                    if (result.error) {
                        setMessage({ type: 'error', text: result.error })
                        toast.error(result.error)
                    } else {
                        const successMessage = 'Request submitted successfully! We will contact you shortly.'
                        setMessage({ type: 'success', text: successMessage })
                        toast.success(successMessage)
                        setDate(undefined)
                        setIsAvailable(null)
                        setEmail('')
                        setFullName('')
                        setCompanyName('')
                        setAccessPassword('')
                    }
                } catch (err) {
                    console.error(err)
                    setMessage({ type: 'error', text: 'An unexpected error occurred.' })
                    toast.error('An unexpected error occurred.')
                }
            })()
        })
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
                    "p-4 rounded-md text-sm border",
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

            {/* Guest Contact Form */}
            {/* Guest Contact Form - Only show if NOT in global mode (or if we want to confirm per item? User said "Add to Request List" button. 
                Usually multi-select means we request once at the end. 
                So hiding the single-item contact form makes sense if we are in global mode.) 
            */}
            {isAvailable && !isGlobalDateMode && (
                <div className="space-y-4 border-t pt-6">
                    <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">
                        Your Contact Information
                    </h3>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name *</Label>
                        <Input
                            id="fullName"
                            type="text"
                            placeholder="Jane Smith"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name (optional)</Label>
                        <Input
                            id="companyName"
                            type="text"
                            placeholder="Acme Corp"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="accessPassword">Access Password (if required)</Label>
                        <Input
                            id="accessPassword"
                            type="password"
                            placeholder="Enter access password"
                            value={accessPassword}
                            onChange={(e) => setAccessPassword(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                            If you were given an access password, enter it here.
                        </p>
                    </div>
                </div>
            )}

            {isGlobalDateMode ? (
                <>
                    {/* Spacer for mobile to prevent content occlusion */}
                    <div className="h-16 md:hidden" />

                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50 md:static md:p-0 md:bg-transparent md:border-none md:z-auto">
                        <Button
                            className="w-full h-12 uppercase tracking-widest text-sm shadow-lg md:shadow-none"
                            disabled={!isAvailable || (isMounted && hasItem(item.id))}
                            onClick={handleAddToRequest}
                        >
                            {isMounted && hasItem(item.id) ? "Added to List" : "Add to Request List"}
                        </Button>
                    </div>
                </>
            ) : (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50 md:static md:p-0 md:bg-transparent md:border-none md:z-auto">
                    <Button
                        className="w-full h-12 uppercase tracking-widest text-sm shadow-lg md:shadow-none"
                        disabled={!isAvailable || isSubmitting || !date?.from || !date?.to || !email.trim() || !fullName.trim()}
                        onClick={handleRequestBooking}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSubmitting ? 'Submitting...' : 'Request Booking'}
                    </Button>
                </div>
            )}

            {message && (
                <div className={cn(
                    "p-4 rounded-md text-sm text-center",
                    message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                    {message.text}
                </div>
            )}
        </div>
    )
}
