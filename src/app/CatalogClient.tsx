"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { Calendar as CalendarIcon, X, ShoppingBag, Plus, Pencil, Check, Loader2, Filter, ChevronDown } from "lucide-react"
import { DateRange } from "react-day-picker"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useRequestStore } from "@/store/request"
import { toast } from "sonner"

interface Item {
    id: string
    name: string
    category: string
    rental_price: number
    image_paths: string[] | null
    status: string
    category_id?: string | null
    collection_id?: string | null
    color?: string | null
    is_booked?: boolean
    conflict_dates?: string | null
}

interface Category {
    id: string
    name: string
}

interface Collection {
    id: string
    name: string
}

interface CatalogClientProps {
    initialItems: Item[]
    categories: Category[]
    collections: Collection[]
}

export function CatalogClient({ initialItems, categories, collections }: CatalogClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Filter State
    const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null)
    const [selectedCollectionId, setSelectedCollectionId] = React.useState<string | null>(null)

    // === CORE STATE ===
    // "Committed" date - the actively applied search
    const [committedDate, setCommittedDate] = React.useState<DateRange | undefined>(() => {
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        if (from && to) {
            try {
                return {
                    from: parse(from, 'yyyy-MM-dd', new Date()),
                    to: parse(to, 'yyyy-MM-dd', new Date())
                }
            } catch {
                return undefined
            }
        }
        return undefined
    })

    // "Draft" date - temporary selection in calendar before applying
    const [draftDate, setDraftDate] = React.useState<DateRange | undefined>(committedDate)

    // UI Lock: Once user has done a search, stay in narrow mode
    const [hasActiveSearch, setHasActiveSearch] = React.useState(() => {
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        return !!(from && to)
    })

    // Calendar popover open state
    const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)
    const [activeDateInput, setActiveDateInput] = React.useState<'from' | 'to' | null>(null)

    const { dateRange: globalDateRange, setDateRange: setGlobalDateRange, addItem, hasItem, removeItem } = useRequestStore()
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    // Sync from Global Store on mount if URL is empty but Store is not
    React.useEffect(() => {
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        if (!from && !to && globalDateRange.from && globalDateRange.to) {
            const parsedDate = {
                from: parse(globalDateRange.from, 'yyyy-MM-dd', new Date()),
                to: parse(globalDateRange.to, 'yyyy-MM-dd', new Date())
            }
            setCommittedDate(parsedDate)
            setDraftDate(parsedDate)
            setHasActiveSearch(true)
        }
    }, []) // Run once on mount

    // Sync committed date to Global Store
    React.useEffect(() => {
        if (committedDate?.from && committedDate?.to) {
            setGlobalDateRange({
                from: format(committedDate.from, 'yyyy-MM-dd'),
                to: format(committedDate.to, 'yyyy-MM-dd')
            })
        } else if (!committedDate) {
            setGlobalDateRange({ from: null, to: null })
        }
    }, [committedDate, setGlobalDateRange])

    const [items, setItems] = React.useState<Item[]>(initialItems)
    const [isLoading, setIsLoading] = React.useState(false)
    const [showUnavailable, setShowUnavailable] = React.useState(false)

    // Fetch items from Supabase (Availability Check)
    const fetchItems = React.useCallback(async () => {
        // Only fetch if we have committed dates (or if we really want to refresh active items)
        if (!committedDate?.from || !committedDate?.to) return

        setIsLoading(true)
        try {
            const supabase = createClient()

            // Use V2 RPC to support "Include Booked" feature
            const { data, error } = await supabase.rpc('get_available_items_v2', {
                p_start_date: format(committedDate.from, 'yyyy-MM-dd'),
                p_end_date: format(committedDate.to, 'yyyy-MM-dd'),
                p_include_booked: showUnavailable
            })

            if (error) throw error

            // Map data to Item interface
            const mappedItems: Item[] = (data || []).map((i: any) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                rental_price: i.rental_price,
                image_paths: i.image_paths,
                status: i.status,
                color: i.color,
                category_id: i.category_id,
                collection_id: i.collection_id,
                is_booked: i.is_booked,
                conflict_dates: i.conflict_dates,
                priority: i.priority // Ensure priority is preserved if needed for sorting
            }))

            setItems(mappedItems)
        } catch (err: any) {
            console.error("Fetch error:", err, JSON.stringify(err, null, 2))
            toast.error(err.message || "Failed to check availability")
            // Fallback to active items if RPC fails? Better to show error.
        } finally {
            setIsLoading(false)
        }
    }, [committedDate, showUnavailable])

    // Effect: Fetch when dates or settings change
    React.useEffect(() => {
        if (committedDate) {
            fetchItems()
        }
    }, [fetchItems])

    // (Client-side filtering logic is defined below at 'filteredItems')

    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/600x400?text=No+Image'
    }

    // === ACTION HANDLERS ===

    // Apply: Commit draft date, update URL, lock UI
    const handleApplySearch = () => {
        if (!draftDate?.from || !draftDate?.to) {
            toast.error("Please select both start and end dates")
            return
        }

        setCommittedDate(draftDate)
        setHasActiveSearch(true)
        setIsCalendarOpen(false)
        setActiveDateInput(null)

        // Update URL
        const params = new URLSearchParams(searchParams.toString())
        params.set('from', format(draftDate.from, 'yyyy-MM-dd'))
        params.set('to', format(draftDate.to, 'yyyy-MM-dd'))
        router.replace(`/catalog?${params.toString()}`, { scroll: false })
    }

    // Reset: Clear all, unlock UI, return to hero mode
    const handleReset = () => {
        setCommittedDate(undefined)
        setDraftDate(undefined)
        setHasActiveSearch(false)
        setIsCalendarOpen(false)
        setActiveDateInput(null)

        // Update URL
        const params = new URLSearchParams(searchParams.toString())
        params.delete('from')
        params.delete('to')
        const queryString = params.toString()
        router.replace(queryString ? `/catalog?${queryString}` : '/catalog', { scroll: false })
    }

    // Micro clear
    const handleClearStartDate = () => {
        setDraftDate(prev => prev ? { ...prev, from: undefined } : undefined)
    }

    const handleClearEndDate = () => {
        setDraftDate(prev => prev ? { ...prev, to: undefined } : undefined)
    }

    // Open Calendar for specific input
    const openCalendar = (type: 'from' | 'to') => {
        setActiveDateInput(type)
        if (!isCalendarOpen) {
            setDraftDate(committedDate) // Sync only if opening fresh
            setIsCalendarOpen(true)
        }
    }

    const handleCalendarOpenChange = (open: boolean) => {
        setIsCalendarOpen(open)
        if (!open) setActiveDateInput(null)
        else if (!activeDateInput) setActiveDateInput('from') // Default to from
    }

    // === ANCHOR DATE SELECTION LOGIC ===
    const handleDayClick = (day: Date) => {
        if (activeDateInput === 'from') {
            // Modifying Start Date
            setDraftDate(prev => {
                const currentTo = prev?.to

                // If new Start > current End, clear End (invalid range)
                if (currentTo && day > currentTo) {
                    return { from: day, to: undefined }
                }

                return { from: day, to: currentTo }
            })

            // AUTO-NEXT: If we are in an empty state (no End date) or we just invalidated the End date,
            // automatically switch focus to the 'End' input to encourage flow.
            if (!draftDate?.to || day > draftDate.to) {
                setActiveDateInput('to')
            }
        } else if (activeDateInput === 'to') {
            // Modifying End Date
            setDraftDate(prev => {
                // If new End < current Start, theoretically invalid.
                // For simplified "Anchor styling", we update End. 
                // Calendar disabled prop prevents selection < From if needed, or we just set it.
                return { from: prev?.from, to: day }
            })
        } else {
            // Fallback (shouldn't happen with anchor logic)
            setDraftDate({ from: day, to: undefined })
        }
    }

    const hasCommittedDate = committedDate?.from && committedDate?.to
    const hasDraftComplete = draftDate?.from && draftDate?.to

    // Calculate rental days for display
    const rentalDays = hasCommittedDate
        ? Math.ceil((committedDate.to!.getTime() - committedDate.from!.getTime()) / (1000 * 60 * 60 * 24))
        : 0

    // Filter Logic
    const filteredItems = React.useMemo(() => {
        return items.filter(item => {
            if (selectedCategoryId && item.category_id !== selectedCategoryId) return false
            if (selectedCollectionId && item.collection_id !== selectedCollectionId) return false
            return true
        })
    }, [items, selectedCategoryId, selectedCollectionId])

    // Dynamic counts for sidebar (based on current items, respecting collection filter)
    const categoryCounts = React.useMemo(() => {
        const counts: Record<string, number> = {}
        const baseItems = selectedCollectionId
            ? items.filter(item => item.collection_id === selectedCollectionId)
            : items
        baseItems.forEach(item => {
            if (item.category_id) {
                counts[item.category_id] = (counts[item.category_id] || 0) + 1
            }
        })
        return counts
    }, [items, selectedCollectionId])

    const collectionCounts = React.useMemo(() => {
        const counts: Record<string, number> = {}
        const baseItems = selectedCategoryId
            ? items.filter(item => item.category_id === selectedCategoryId)
            : items
        baseItems.forEach(item => {
            if (item.collection_id) {
                counts[item.collection_id] = (counts[item.collection_id] || 0) + 1
            }
        })
        return counts
    }, [items, selectedCategoryId])


    // Mobile Calendar State
    const [isMobileCalendarOpen, setIsMobileCalendarOpen] = React.useState(false)

    const handleMobileCalendarOpenChange = (open: boolean) => {
        setIsMobileCalendarOpen(open)
        if (open) setActiveDateInput('from')
        else setActiveDateInput(null)
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Layout Container */}
            <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-8 flex flex-col md:flex-row gap-12">

                {/* Mobile Filter Bar */}
                <div className="md:hidden sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-slate-100 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 mb-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {/* Mobile Date Picker Trigger */}
                    <Popover open={isMobileCalendarOpen} onOpenChange={handleMobileCalendarOpenChange}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 rounded-full px-4 text-xs font-medium border-slate-200 bg-white shadow-sm flex-shrink-0">
                                <CalendarIcon className="h-3.5 w-3.5 mr-2 text-slate-500" />
                                {hasCommittedDate
                                    ? `${format(committedDate!.from!, 'MMM d')} - ${format(committedDate!.to!, 'MMM d')}`
                                    : "Select Dates"
                                }
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-0" align="start" sideOffset={8}>
                            {/* Reused Calendar Content - same as desktop but strictly mobile styled if needed. 
                                For DRY, we are duplicating logic here for safety. Ideally refactor to component. */}
                            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center gap-2 text-sm justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setActiveDateInput('from')}
                                            className={cn("text-xs font-medium px-2 py-1 rounded bg-white border transition-colors",
                                                activeDateInput === 'from' ? "border-slate-900 ring-1 ring-slate-900 text-slate-900" : "border-slate-200 text-slate-500",
                                                draftDate?.from ? "text-slate-900" : "text-slate-400"
                                            )}
                                        >
                                            {draftDate?.from ? format(draftDate.from, "MMM d") : 'Start'}
                                        </button>
                                        <span className="text-slate-300">→</span>
                                        <button
                                            onClick={() => setActiveDateInput('to')}
                                            className={cn("text-xs font-medium px-2 py-1 rounded bg-white border transition-colors",
                                                activeDateInput === 'to' ? "border-slate-900 ring-1 ring-slate-900 text-slate-900" : "border-slate-200 text-slate-500",
                                                draftDate?.to ? "text-slate-900" : "text-slate-400"
                                            )}
                                        >
                                            {draftDate?.to ? format(draftDate.to, "MMM d") : 'End'}
                                        </button>
                                    </div>
                                    {(draftDate?.from || draftDate?.to) && (
                                        <button
                                            onClick={() => {
                                                setDraftDate(undefined)
                                                if (!committedDate) handleReset()
                                            }}
                                            className="text-[10px] text-slate-400 hover:text-red-500 uppercase tracking-wider font-medium"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                            <Calendar
                                initialFocus
                                mode="range"
                                month={draftDate?.from || new Date()}
                                selected={draftDate}
                                onDayClick={handleDayClick}
                                numberOfMonths={1}
                                disabled={[
                                    { before: new Date() },
                                    activeDateInput === 'to' && draftDate?.from ? { before: draftDate.from } : { before: new Date() }
                                ]}
                                className="p-3"
                            />
                            <div className="p-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                                <Button variant="ghost" size="sm" onClick={() => setIsMobileCalendarOpen(false)} className="h-8 text-xs">
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        handleApplySearch()
                                        setIsMobileCalendarOpen(false)
                                    }}
                                    disabled={!hasDraftComplete || isLoading}
                                    className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800"
                                >
                                    {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                                    Apply
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* All Filters Drawer */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 rounded-full px-4 text-xs font-medium border-slate-200 bg-white shadow-sm flex-shrink-0">
                                <Filter className="h-3.5 w-3.5 mr-2 text-slate-500" />
                                All Filters
                                {(selectedCategoryId || selectedCollectionId) && (
                                    <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] text-white">
                                        {(selectedCategoryId ? 1 : 0) + (selectedCollectionId ? 1 : 0)}
                                    </span>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh] rounded-t-xl px-0">
                            <SheetHeader className="px-6 pb-4 border-b">
                                <SheetTitle className="text-left">Filters</SheetTitle>
                                <SheetDescription className="text-left">
                                    Refine your search by category and collection.
                                </SheetDescription>
                            </SheetHeader>
                            <div className="overflow-y-auto h-full px-6 py-6 space-y-8">
                                {/* Categories */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center justify-between">
                                        Categories
                                        {selectedCategoryId && (
                                            <button onClick={() => setSelectedCategoryId(null)} className="text-blue-600 font-normal text-xs">
                                                Reset
                                            </button>
                                        )}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                                                className={cn(
                                                    "px-3 py-2 text-xs rounded-md border text-left transition-all",
                                                    selectedCategoryId === cat.id
                                                        ? "bg-slate-900 text-white border-slate-900"
                                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                                )}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span>{cat.name}</span>
                                                    <span className={cn("text-[10px]", selectedCategoryId === cat.id ? "text-slate-400" : "text-slate-400")}>
                                                        {categoryCounts[cat.id] || 0}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Collections */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center justify-between">
                                        Collections
                                        {selectedCollectionId && (
                                            <button onClick={() => setSelectedCollectionId(null)} className="text-blue-600 font-normal text-xs">
                                                Reset
                                            </button>
                                        )}
                                    </h3>
                                    <div className="space-y-2">
                                        {collections.map(col => (
                                            <button
                                                key={col.id}
                                                onClick={() => setSelectedCollectionId(selectedCollectionId === col.id ? null : col.id)}
                                                className={cn(
                                                    "w-full px-3 py-2 text-xs rounded-md border text-left transition-all flex items-center justify-between",
                                                    selectedCollectionId === col.id
                                                        ? "bg-slate-50 border-slate-900 text-slate-900 font-medium"
                                                        : "bg-white text-slate-600 border-slate-200"
                                                )}
                                            >
                                                <span>{col.name}</span>
                                                <span className="text-slate-400 text-[10px]">{collectionCounts[col.id] || 0}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Sidebar Filters */}
                <aside className="hidden md:block w-full md:w-56 space-y-12 flex-shrink-0 pt-2">
                    {/* 1. Date Picker (Minimalist) */}
                    <div>
                        <h3 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-6">
                            Rental Dates
                        </h3>
                        <Popover open={isCalendarOpen} onOpenChange={handleCalendarOpenChange}>
                            <PopoverTrigger asChild>
                                <div className="space-y-4">
                                    {/* Start Date */}
                                    <button
                                        onClick={() => openCalendar('from')}
                                        className={cn(
                                            "w-full text-left py-1 border-b transition-colors group relative",
                                            activeDateInput === 'from' && isCalendarOpen
                                                ? "border-slate-900"
                                                : "border-slate-200 hover:border-slate-300"
                                        )}
                                    >
                                        <span className="block text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider font-medium">Start</span>
                                        <span className={cn("text-sm font-medium block", (isCalendarOpen ? draftDate?.from : committedDate?.from) ? "text-slate-900" : "text-slate-300")}>
                                            {(isCalendarOpen ? draftDate?.from : committedDate?.from)
                                                ? format((isCalendarOpen ? draftDate!.from! : committedDate!.from!), "MMM d, yyyy")
                                                : "Select date"}
                                        </span>
                                    </button>

                                    {/* End Date */}
                                    <button
                                        onClick={() => openCalendar('to')}
                                        className={cn(
                                            "w-full text-left py-1 border-b transition-colors group relative",
                                            activeDateInput === 'to' && isCalendarOpen
                                                ? "border-slate-900"
                                                : "border-slate-200 hover:border-slate-300"
                                        )}
                                    >
                                        <span className="block text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider font-medium">End</span>
                                        <span className={cn("text-sm font-medium block", (isCalendarOpen ? draftDate?.to : committedDate?.to) ? "text-slate-900" : "text-slate-300")}>
                                            {(isCalendarOpen ? draftDate?.to : committedDate?.to)
                                                ? format((isCalendarOpen ? draftDate!.to! : committedDate!.to!), "MMM d, yyyy")
                                                : "Select date"}
                                        </span>
                                    </button>

                                    {hasCommittedDate && !isCalendarOpen && (
                                        <div className="pt-2 flex items-center justify-between">
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {rentalDays} days
                                            </span>
                                            <span className="text-[10px] text-slate-400 hover:text-red-500 cursor-pointer font-medium tracking-wide uppercase transition-colors" onClick={(e) => {
                                                e.stopPropagation()
                                                handleReset()
                                            }}>
                                                Clear
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="right" sideOffset={20}>
                                <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                    <div className="flex items-center gap-2 text-sm justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-xs font-medium px-2 py-1 rounded bg-white border", draftDate?.from ? "text-slate-900" : "text-slate-400")}>
                                                {draftDate?.from ? format(draftDate.from, "MMM d") : 'Start'}
                                            </span>
                                            <span className="text-slate-300">→</span>
                                            <span className={cn("text-xs font-medium px-2 py-1 rounded bg-white border", draftDate?.to ? "text-slate-900" : "text-slate-400")}>
                                                {draftDate?.to ? format(draftDate.to, "MMM d") : 'End'}
                                            </span>
                                        </div>
                                        {(draftDate?.from || draftDate?.to) && (
                                            <button
                                                onClick={() => {
                                                    setDraftDate(undefined)
                                                    if (!committedDate) handleReset()
                                                }}
                                                className="text-[10px] text-slate-400 hover:text-red-500 uppercase tracking-wider font-medium"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    month={draftDate?.from || new Date()}
                                    selected={draftDate}
                                    onDayClick={handleDayClick}
                                    numberOfMonths={1}
                                    disabled={[
                                        { before: new Date() },
                                        activeDateInput === 'to' && draftDate?.from ? { before: draftDate.from } : { before: new Date() }
                                    ]}
                                    className="p-3"
                                />
                                <div className="p-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                                    <Button variant="ghost" size="sm" onClick={() => setIsCalendarOpen(false)} className="h-8 text-xs">
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleApplySearch}
                                        disabled={!hasDraftComplete || isLoading}
                                        className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800"
                                    >
                                        {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                                        Apply Dates
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Include Booked Items Switch */}
                        {hasCommittedDate && (
                            <div className="flex items-center gap-2 mt-4 pl-0">
                                <Switch
                                    id="show-unavailable"
                                    checked={showUnavailable}
                                    onCheckedChange={setShowUnavailable}
                                    className="scale-90 data-[state=checked]:bg-slate-900"
                                />
                                <Label htmlFor="show-unavailable" className="text-xs text-slate-500 cursor-pointer select-none">
                                    Include booked items
                                </Label>
                            </div>
                        )}
                    </div>

                    {/* 2. Categories */}
                    <div>
                        <h3
                            className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-6 cursor-pointer flex items-center justify-between group"
                            onClick={() => setSelectedCategoryId(null)}
                        >
                            Categories
                            {selectedCategoryId && <span className="text-[9px] font-normal text-slate-400 group-hover:text-red-500 transition-colors">CLEAR</span>}
                        </h3>
                        <ul className="space-y-1 pl-0">
                            {categories.length === 0 && <li className="text-xs text-slate-400 py-1">No categories</li>}
                            {categories.map(cat => {
                                const count = categoryCounts[cat.id] || 0
                                const isSelected = selectedCategoryId === cat.id
                                return (
                                    <li key={cat.id}>
                                        <button
                                            onClick={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                                            disabled={isLoading}
                                            className={cn(
                                                "w-full text-left py-1.5 pl-4 pr-0 border-l-[2px] transition-all flex items-center group relative",
                                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                                isSelected
                                                    ? "border-slate-900"
                                                    : "border-transparent hover:border-slate-200"
                                            )}
                                        >
                                            <span className={cn(
                                                "text-sm leading-relaxed transition-colors",
                                                isSelected ? "font-medium text-slate-900" : "text-slate-500 group-hover:text-slate-900"
                                            )}>
                                                {cat.name}
                                            </span>
                                            <span className="ml-auto text-[10px] text-slate-300 group-hover:text-slate-400 tabular-nums">
                                                {count}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>

                    {/* 3. Collections */}
                    <div>
                        <h3
                            className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-6 cursor-pointer flex items-center justify-between group"
                            onClick={() => setSelectedCollectionId(null)}
                        >
                            Collections
                            {selectedCollectionId && <span className="text-[9px] font-normal text-slate-400 group-hover:text-red-500 transition-colors">CLEAR</span>}
                        </h3>
                        <ul className="space-y-1 pl-0">
                            {collections.length === 0 && <li className="text-xs text-slate-400 py-1">No collections</li>}
                            {collections.map(col => {
                                const count = collectionCounts[col.id] || 0
                                const isSelected = selectedCollectionId === col.id
                                return (
                                    <li key={col.id}>
                                        <button
                                            onClick={() => setSelectedCollectionId(isSelected ? null : col.id)}
                                            disabled={isLoading}
                                            className={cn(
                                                "w-full text-left py-1.5 pl-4 pr-0 border-l-[2px] transition-all flex items-center group relative",
                                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                                isSelected
                                                    ? "border-slate-900"
                                                    : "border-transparent hover:border-slate-200"
                                            )}
                                        >
                                            <span className={cn(
                                                "text-sm leading-relaxed transition-colors",
                                                isSelected ? "font-medium text-slate-900" : "text-slate-500 group-hover:text-slate-900"
                                            )}>
                                                {col.name}
                                            </span>
                                            <span className="ml-auto text-[10px] text-slate-300 group-hover:text-slate-400 tabular-nums">
                                                {count}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                </aside>

                {/* Grid Section - Sidebar First Layout */}
                <section className="flex-1 relative min-h-[500px]">

                    {/* Empty State Guidance Banner (When no dates selected) */}
                    {!hasCommittedDate && !isLoading && (
                        <div className="mb-4 text-center text-slate-400 text-sm font-light tracking-wide">
                            Discover the collection · Select dates to check availability
                        </div>
                    )}

                    {/* Loading Overlay */}
                    <div
                        className={cn(
                            "absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 backdrop-blur-[1px] transition-all duration-300",
                            isLoading ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
                        )}
                    >
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
                            <p className="text-sm font-medium text-slate-600">Scanning availability...</p>
                        </div>
                    </div>

                    {/* Grid Content */}
                    <div className={cn("transition-opacity duration-300", isLoading ? "opacity-40 pointer-events-none" : "opacity-100")}>
                        {filteredItems.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                {filteredItems.map((item, index) => (
                                    <div key={item.id} className="group flex flex-col h-full">
                                        <Link href={hasCommittedDate
                                            ? `/catalog/${item.id}?start=${format(committedDate!.from!, 'yyyy-MM-dd')}&end=${format(committedDate!.to!, 'yyyy-MM-dd')}`
                                            : `/catalog/${item.id}`
                                        } className="block flex-1">
                                            <div className={cn("relative aspect-[4/5] bg-slate-100 overflow-hidden", item.is_booked && "grayscale")}>
                                                <Image
                                                    src={getImageUrl(item.image_paths)}
                                                    alt={item.name}
                                                    fill
                                                    className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
                                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                                    priority={index < 10}
                                                />
                                            </div>
                                            <div className={cn("space-y-0.5 mb-2", item.is_booked && "opacity-50")}>
                                                <h3 className="text-sm font-medium text-slate-900 truncate group-hover:text-slate-600 transition-colors">
                                                    {item.name}
                                                </h3>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {item.category} {item.color ? `· ${item.color}` : ''}
                                                </p>
                                            </div>
                                        </Link>

                                        <div className="flex items-center justify-between gap-3 mt-auto h-9">
                                            {/* Left: Price Area (Fixed layout to prevent shifts) */}
                                            <div className="flex flex-col justify-center min-w-[80px] whitespace-nowrap">
                                                <div className="text-[11px] text-slate-400 font-normal leading-tight">
                                                    ${item.rental_price}/d
                                                </div>
                                                <div className={cn("text-sm font-semibold leading-tight", hasCommittedDate ? "text-slate-900" : "text-slate-300")}>
                                                    {hasCommittedDate
                                                        ? `$${rentalDays * item.rental_price} Total`
                                                        : '-- Total'
                                                    }
                                                </div>
                                            </div>

                                            {/* Right: Add/Remove Button (Fixed width container for stability) */}
                                            <div className="flex-shrink-0 w-[70px] flex justify-end">
                                                {hasCommittedDate ? (
                                                    item.is_booked ? (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    className="w-full h-9 rounded-full bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200 hover:text-slate-600 px-0 text-[10px] font-medium uppercase tracking-wide"
                                                                    onClick={(e) => {
                                                                        e.preventDefault()
                                                                        e.stopPropagation()
                                                                    }}
                                                                >
                                                                    Booked
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-3 text-xs text-slate-500 max-w-[200px]" align="end">
                                                                <p className="font-semibold text-slate-900 mb-1">Unavailable</p>
                                                                <p>Dates: {item.conflict_dates}</p>
                                                            </PopoverContent>
                                                        </Popover>
                                                    ) : (
                                                        isMounted && hasItem(item.id) ? (
                                                            <Button
                                                                className="h-9 w-9 rounded-full bg-white border border-green-200 text-green-500 hover:text-green-600 hover:border-green-300 hover:bg-green-50 p-0 flex items-center justify-center transition-all animate-in zoom-in-95 fade-in duration-200 group"
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    removeItem(item.id)
                                                                    toast("Item removed from request", {
                                                                        action: {
                                                                            label: 'Undo',
                                                                            onClick: () => addItem({
                                                                                id: item.id,
                                                                                name: item.name,
                                                                                category: item.category,
                                                                                rental_price: item.rental_price,
                                                                                image_paths: item.image_paths,
                                                                                status: item.status
                                                                            })
                                                                        }
                                                                    })
                                                                }}
                                                            >
                                                                <Check className="h-5 w-5" />
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                className="w-full h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium animate-in zoom-in-95 fade-in duration-200 px-0"
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    addItem({
                                                                        id: item.id,
                                                                        name: item.name,
                                                                        category: item.category,
                                                                        rental_price: item.rental_price,
                                                                        image_paths: item.image_paths,
                                                                        status: item.status
                                                                    })
                                                                    toast.success("Added to request")
                                                                }}
                                                            >
                                                                + Add
                                                            </Button>
                                                        )
                                                    )
                                                ) : (
                                                    <Button
                                                        className="w-full h-9 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 text-xs font-medium px-0"
                                                        disabled
                                                    >
                                                        + Add
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                {hasCommittedDate ? (
                                    <>
                                        <h3 className="text-base text-slate-400 font-light">
                                            No items available for selected dates.
                                        </h3>
                                        <Button
                                            variant="ghost"
                                            className="mt-3 text-slate-400 hover:text-slate-600 text-sm"
                                            onClick={handleReset}
                                        >
                                            Clear dates
                                        </Button>
                                    </>
                                ) : (
                                    <h3 className="text-base text-slate-400 font-light">
                                        The collection is currently empty.
                                    </h3>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div >
    )
}
