"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { Calendar as CalendarIcon, X, ShoppingBag, Plus } from "lucide-react"
import { DateRange } from "react-day-picker"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"

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

interface Item {
    id: string
    name: string
    category: string
    rental_price: number
    image_paths: string[] | null
    status: string
    category_id?: string | null
    collection_id?: string | null
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

    // Initialize date from URL params
    const [date, setDate] = React.useState<DateRange | undefined>(() => {
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

    const { dateRange: globalDateRange, setDateRange: setGlobalDateRange, addItem, hasItem } = useRequestStore()
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    // Sync from Global Store on mount if URL is empty but Store is not
    React.useEffect(() => {
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        if (!from && !to && globalDateRange.from && globalDateRange.to) {
            setDate({
                from: parse(globalDateRange.from, 'yyyy-MM-dd', new Date()),
                to: parse(globalDateRange.to, 'yyyy-MM-dd', new Date())
            })
        }
    }, []) // Run once on mount

    // Sync to Global Store when date changes
    React.useEffect(() => {
        if (date?.from && date?.to) {
            setGlobalDateRange({
                from: format(date.from, 'yyyy-MM-dd'),
                to: format(date.to, 'yyyy-MM-dd')
            })
        } else if (!date) {
            setGlobalDateRange({ from: null, to: null })
        }
    }, [date, setGlobalDateRange])

    const [items, setItems] = React.useState<Item[]>(initialItems)
    const [isLoading, setIsLoading] = React.useState(false)
    const supabase = createClient()

    // Helper: check if date range is complete (both dates) or empty (no dates)
    const isDateRangeComplete = date?.from && date?.to
    const isDateRangeEmpty = !date?.from && !date?.to
    const isValidState = isDateRangeComplete || isDateRangeEmpty

    // Sync date to URL (with guards to prevent updates during incomplete selection)
    React.useEffect(() => {
        // Guard: only sync when range is complete or empty, not in-between
        if (!isValidState) {
            return
        }

        const currentFrom = searchParams.get('from')
        const currentTo = searchParams.get('to')

        const newFrom = date?.from ? format(date.from, 'yyyy-MM-dd') : null
        const newTo = date?.to ? format(date.to, 'yyyy-MM-dd') : null

        // Only update URL if values actually changed
        if (currentFrom === newFrom && currentTo === newTo) {
            return
        }

        const params = new URLSearchParams(searchParams.toString())

        if (newFrom && newTo) {
            params.set('from', newFrom)
            params.set('to', newTo)
        } else {
            params.delete('from')
            params.delete('to')
        }

        const newUrl = params.toString() ? `?${params.toString()}` : '/'
        router.replace(newUrl, { scroll: false })
    }, [date, router, searchParams, isValidState])

    // Fetch available items when date changes
    React.useEffect(() => {
        // Guard: only fetch when range is complete or empty
        if (!isValidState) {
            return
        }

        async function fetchAvailableItems() {
            if (!date?.from || !date?.to) {
                // No date selected - show all initial items
                setItems(initialItems)
                return
            }

            setIsLoading(true)
            try {
                const { data, error } = await supabase.rpc('get_available_items', {
                    p_start_date: format(date.from, 'yyyy-MM-dd'),
                    p_end_date: format(date.to, 'yyyy-MM-dd')
                })

                if (error) {
                    // If RPC doesn't exist or fails, show warning and keep showing all items
                    console.warn('get_available_items RPC not available, showing all items. Run the SQL migration to enable filtering.', error.message)
                    setItems(initialItems)
                    return
                }

                setItems(data || [])
            } catch (err) {
                console.error('Unexpected error:', err)
                setItems(initialItems)
            } finally {
                setIsLoading(false)
            }
        }

        fetchAvailableItems()
    }, [date, supabase, initialItems, isValidState])


    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/600x400?text=No+Image'
    }

    const clearDates = () => {
        setDate(undefined)
    }

    const hasDateSelected = date?.from && date?.to

    // Calculate rental days for display
    const rentalDays = hasDateSelected
        ? Math.ceil((date.to!.getTime() - date.from!.getTime()) / (1000 * 60 * 60 * 24))
        : 0

    // Filter Logic
    const filteredItems = React.useMemo(() => {
        return items.filter(item => {
            if (selectedCategoryId && item.category_id !== selectedCategoryId) return false
            if (selectedCollectionId && item.collection_id !== selectedCollectionId) return false
            return true
        })
    }, [items, selectedCategoryId, selectedCollectionId])

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section with Date Picker */}
            <section className="py-12 px-8 bg-gray-50 border-b border-gray-100">
                <div className="max-w-[1600px] mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-light tracking-tight text-gray-900 mb-4">
                            The Collection
                        </h1>
                        <p className="text-gray-500 max-w-2xl mx-auto">
                            Select your rental dates to see available pieces
                        </p>
                    </div>

                    {/* Date Range Picker */}
                    <div className="flex justify-center items-center gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-[320px] justify-start text-left font-normal h-12 border-2",
                                        !date && "text-muted-foreground",
                                        hasDateSelected && "border-green-500 bg-green-50"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date?.from ? (
                                        date.to ? (
                                            <>
                                                {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(date.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Select rental dates</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="center">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={date?.from}
                                    selected={date}
                                    onSelect={setDate}
                                    numberOfMonths={2}
                                    disabled={{ before: new Date() }}
                                />
                            </PopoverContent>
                        </Popover>

                        {hasDateSelected && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={clearDates}
                                className="text-gray-500 hover:text-gray-900"
                                title="Clear dates"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Status indicator */}
                    <div className="text-center mt-4 space-y-2 min-h-[48px]">
                        {isLoading ? (
                            <span className="inline-flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
                                <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Searching available items...
                            </span>
                        ) : hasDateSelected ? (
                            <>
                                <span className="inline-flex items-center gap-2 text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    {filteredItems.length} available item{filteredItems.length !== 1 ? 's' : ''} for {rentalDays} day{rentalDays !== 1 ? 's' : ''}
                                </span>
                                <p className="text-xs text-gray-400">
                                    {format(date.from!, "MMM d")} - {format(date.to!, "MMM d, yyyy")}
                                </p>
                            </>
                        ) : null}
                    </div>
                </div>
            </section>

            {/* Layout Container */}
            <div className="max-w-[1700px] mx-auto px-4 sm:px-8 py-12 flex flex-col md:flex-row gap-12">

                {/* Sidebar Filters */}
                <aside className="w-full md:w-64 space-y-12 flex-shrink-0">
                    <div>
                        <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider mb-6 pb-2 border-b border-gray-100 cursor-pointer" onClick={() => setSelectedCategoryId(null)}>
                            Categories {selectedCategoryId && <span className="ml-2 text-xs text-gray-400 font-normal">(Clear)</span>}
                        </h3>
                        <ul className="space-y-3">
                            {categories.length === 0 && <li className="text-sm text-gray-400">No categories found</li>}
                            {categories.map(cat => (
                                <li key={cat.id}>
                                    <button
                                        onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                                        className={cn(
                                            "text-sm font-light hover:text-black transition-colors text-left w-full",
                                            selectedCategoryId === cat.id ? "text-black font-medium underline underline-offset-4" : "text-gray-500"
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider mb-6 pb-2 border-b border-gray-100 cursor-pointer" onClick={() => setSelectedCollectionId(null)}>
                            Collections {selectedCollectionId && <span className="ml-2 text-xs text-gray-400 font-normal">(Clear)</span>}
                        </h3>
                        <ul className="space-y-3">
                            {collections.length === 0 && <li className="text-sm text-gray-400">No collections found</li>}
                            {collections.map(col => (
                                <li key={col.id}>
                                    <button
                                        onClick={() => setSelectedCollectionId(selectedCollectionId === col.id ? null : col.id)}
                                        className={cn(
                                            "text-sm font-light hover:text-black transition-colors text-left w-full",
                                            selectedCollectionId === col.id ? "text-black font-medium underline underline-offset-4" : "text-gray-500"
                                        )}
                                    >
                                        {col.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* Grid Section */}
                <section className="flex-1">
                    {isLoading ? (
                        <div className="text-center py-20">
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-gray-900"></div>
                            <p className="mt-4 text-gray-500">Loading available items...</p>
                        </div>
                    ) : filteredItems.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-x-8 gap-y-12">
                            {filteredItems.map((item, index) => (
                                <div key={item.id} className="group block">
                                    <Link href={hasDateSelected
                                        ? `/catalog/${item.id}?start=${format(date!.from!, 'yyyy-MM-dd')}&end=${format(date!.to!, 'yyyy-MM-dd')}`
                                        : `/catalog/${item.id}`
                                    }>
                                        <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden rounded-sm mb-4">
                                            <Image
                                                src={getImageUrl(item.image_paths)}
                                                alt={item.name}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                                priority={index === 0}
                                            />
                                            {hasDateSelected && (
                                                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                                    Available
                                                </div>
                                            )}
                                            {item.collection_id && (
                                                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-gray-900 text-[10px] px-2 py-1 rounded-sm uppercase tracking-wider border border-gray-100 shadow-sm">
                                                    {collections.find(c => c.id === item.collection_id)?.name}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
                                                    {item.name}
                                                </h3>
                                                <p className="text-sm text-gray-500 capitalize">{item.category}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-light text-gray-900">
                                                    ${item.rental_price}
                                                </p>
                                                <p className="text-xs text-gray-400">/day</p>
                                            </div>
                                        </div>
                                    </Link>

                                    {/* Action button: Add to Request */}
                                    <div className="mt-4">
                                        {hasDateSelected ? (
                                            isMounted && hasItem(item.id) ? (
                                                <Button className="w-full gap-2 bg-green-100 text-green-700 hover:bg-green-200 border border-green-200" disabled>
                                                    <ShoppingBag className="h-4 w-4" />
                                                    Added to Request
                                                </Button>
                                            ) : (
                                                <Button
                                                    className="w-full gap-2"
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
                                                        toast.success("Item added to request list")
                                                    }}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Add to Request
                                                </Button>
                                            )
                                        ) : (
                                            <Button
                                                variant="outline"
                                                className="w-full text-gray-400"
                                                disabled
                                                title="Please select rental dates first"
                                            >
                                                <CalendarIcon className="h-4 w-4 mr-2" />
                                                Select dates first
                                            </Button>
                                        )}
                                    </div>

                                    {/* Price estimate when dates selected */}
                                    {hasDateSelected && (
                                        <div className="mt-2 text-center text-sm text-gray-500">
                                            Est. total: <span className="font-medium text-gray-900">${(item.rental_price * rentalDays).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-32">
                            {hasDateSelected ? (
                                <>
                                    <h3 className="text-xl text-gray-400 font-light">
                                        No items available for selected dates or filters
                                    </h3>
                                    <p className="text-gray-400 mt-2">Try selecting different dates or clearing filters</p>
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={clearDates}
                                    >
                                        Clear dates
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-xl text-gray-400 font-light">
                                        No items in the collection match your filter.
                                    </h3>
                                    <Link
                                        href="/admin/items/new"
                                        className="inline-block mt-4 text-sm text-black underline underline-offset-4 hover:text-gray-600"
                                    >
                                        Admin: Add your first item
                                    </Link>
                                </>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
