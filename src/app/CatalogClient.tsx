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
    const supabase = createClient()

    // Fetch available items when COMMITTED date changes (not draft)
    React.useEffect(() => {
        async function fetchAvailableItems() {
            if (!committedDate?.from || !committedDate?.to) {
                setItems(initialItems)
                return
            }

            setIsLoading(true)
            try {
                // Enforce minimum loading time of 800ms
                const [rpcResult] = await Promise.all([
                    supabase.rpc('get_available_items', {
                        p_start_date: format(committedDate.from, 'yyyy-MM-dd'),
                        p_end_date: format(committedDate.to, 'yyyy-MM-dd')
                    }),
                    new Promise(resolve => setTimeout(resolve, 800))
                ])

                const { data, error } = rpcResult

                if (error) {
                    console.warn('get_available_items RPC not available, showing all items.', error.message)
                    setItems(initialItems)
                    return
                }

                const visibleCollectionIds = new Set(collections.map(c => c.id))
                const filteredData = ((data as Item[]) || []).filter(item => !item.collection_id || visibleCollectionIds.has(item.collection_id))
                setItems(filteredData)
            } catch (err) {
                console.error('Unexpected error:', err)
                setItems(initialItems)
            } finally {
                setIsLoading(false)
            }
        }

        fetchAvailableItems()
    }, [committedDate, supabase, initialItems, collections])

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
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-8">

                {/* Mobile Filter Bar */}
                <div className="md:hidden sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-slate-100 -mx-4 px-4 py-3 mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
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
                <aside className="hidden md:block w-full md:w-48 lg:w-56 space-y-10 flex-shrink-0 pt-1">
                    {/* 1. Date Picker (Sidebar First) */}
                    <div>
                        <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4 pb-2 border-b border-slate-100">
                            Rental Dates
                        </h3>
                        <Popover open={isCalendarOpen} onOpenChange={handleCalendarOpenChange}>
                            <PopoverTrigger asChild>
                                <div className="space-y-2">
                                    {/* Start Date Anchor */}
                                    <button
                                        onClick={() => openCalendar('from')}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-sm border transition-all text-sm group",
                                            activeDateInput === 'from' && isCalendarOpen
                                                ? "border-slate-900 ring-1 ring-slate-900 bg-white"
                                                : "bg-slate-50 border-slate-100 hover:border-slate-300"
                                        )}
                                    >
                                        <span className="block text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider font-medium">Start</span>
                                        <span className={cn("font-medium", (isCalendarOpen ? draftDate?.from : committedDate?.from) ? "text-slate-900" : "text-slate-400")}>
                                            {(isCalendarOpen ? draftDate?.from : committedDate?.from)
                                                ? format((isCalendarOpen ? draftDate!.from! : committedDate!.from!), "MMM d, yyyy")
                                                : "Select date"}
                                        </span>
                                    </button>

                                    {/* End Date Anchor */}
                                    <button
                                        onClick={() => openCalendar('to')}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-sm border transition-all text-sm group",
                                            activeDateInput === 'to' && isCalendarOpen
                                                ? "border-slate-900 ring-1 ring-slate-900 bg-white"
                                                : "bg-slate-50 border-slate-100 hover:border-slate-300"
                                        )}
                                    >
                                        <span className="block text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider font-medium">End</span>
                                        <span className={cn("font-medium", (isCalendarOpen ? draftDate?.to : committedDate?.to) ? "text-slate-900" : "text-slate-400")}>
                                            {(isCalendarOpen ? draftDate?.to : committedDate?.to)
                                                ? format((isCalendarOpen ? draftDate!.to! : committedDate!.to!), "MMM d, yyyy")
                                                : "Select date"}
                                        </span>
                                    </button>

                                    {hasCommittedDate && !isCalendarOpen && (
                                        <div className="pt-1 flex items-center justify-between px-1">
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {rentalDays} days
                                            </span>
                                            <span className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer font-medium" onClick={(e) => {
                                                e.stopPropagation()
                                                handleReset()
                                            }}>
                                                Reset
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" side="right" sideOffset={10}>
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
                    </div>

                    {/* 2. Categories */}
                    <div>
                        <h3
                            className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4 pb-2 border-b border-slate-100 cursor-pointer flex items-center justify-between"
                            onClick={() => setSelectedCategoryId(null)}
                        >
                            Categories
                            {selectedCategoryId && <span className="text-[9px] font-normal text-blue-500 hover:text-blue-600">Clear</span>}
                        </h3>
                        <ul className="space-y-1">
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
                                                "text-xs transition-all text-left w-full py-1.5 px-2 rounded-sm flex items-center justify-between",
                                                "hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed",
                                                isSelected
                                                    ? "text-slate-900 font-medium bg-slate-50"
                                                    : "text-slate-500"
                                            )}
                                        >
                                            <span>{cat.name}</span>
                                            <span className={cn(
                                                "text-[10px] tabular-nums",
                                                isSelected ? "text-slate-600" : "text-slate-400"
                                            )}>
                                                ({count})
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
                            className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4 pb-2 border-b border-slate-100 cursor-pointer flex items-center justify-between"
                            onClick={() => setSelectedCollectionId(null)}
                        >
                            Collections
                            {selectedCollectionId && <span className="text-[9px] font-normal text-blue-500 hover:text-blue-600">Clear</span>}
                        </h3>
                        <ul className="space-y-1">
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
                                                "text-xs transition-all text-left w-full py-1.5 px-2 rounded-sm flex items-center justify-between",
                                                "hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed",
                                                isSelected
                                                    ? "text-slate-900 font-medium bg-slate-50"
                                                    : "text-slate-500"
                                            )}
                                        >
                                            <span>{col.name}</span>
                                            <span className={cn(
                                                "text-[10px] tabular-nums",
                                                isSelected ? "text-slate-600" : "text-slate-400"
                                            )}>
                                                ({count})
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
                        <div className="mb-6 text-center text-slate-400 text-sm py-4 font-light tracking-wide">
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
                                            <div className="relative aspect-square bg-slate-100 overflow-hidden rounded mb-2">
                                                <Image
                                                    src={getImageUrl(item.image_paths)}
                                                    alt={item.name}
                                                    fill
                                                    className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
                                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                                    priority={index < 10}
                                                />
                                                {hasCommittedDate && (
                                                    <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 tracking-wider rounded-sm">
                                                        Available
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-0.5 mb-2">
                                                <h3 className="text-sm font-medium text-slate-900 truncate group-hover:text-slate-600 transition-colors">
                                                    {item.name}
                                                </h3>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {item.category} {item.color ? `· ${item.color}` : ''}
                                                </p>
                                            </div>
                                        </Link>

                                        {/* Split Action Footer */}
                                        <div className="flex items-center justify-between gap-3 mt-auto">
                                            {/* Left: Price Area */}
                                            <div className="flex flex-col justify-center">
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

                                            {/* Right: Add Button */}
                                            <div className="flex-shrink-0">
                                                {hasCommittedDate ? (
                                                    isMounted && hasItem(item.id) ? (
                                                        <Button
                                                            className="h-9 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 text-xs font-medium animate-in zoom-in-95 fade-in duration-200"
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                removeItem(item.id)
                                                                toast("Item removed", {
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
                                                            <X className="h-3.5 w-3.5 mr-1" />
                                                            Remove
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            className="px-4 h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium animate-in zoom-in-95 fade-in duration-200"
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
                                                ) : (
                                                    <Button
                                                        className="px-4 h-9 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 text-xs font-medium"
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
