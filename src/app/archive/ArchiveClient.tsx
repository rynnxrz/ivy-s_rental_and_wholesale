"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"

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

interface ArchiveClientProps {
    initialItems: Item[]
    categories: Category[]
    collections: Collection[]
}

export function ArchiveClient({ initialItems, categories, collections }: ArchiveClientProps) {
    // Filter State
    const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null)
    const [selectedCollectionId, setSelectedCollectionId] = React.useState<string | null>(null)

    // Mobile Calendar State (Used for Filters only here, no calendar)
    const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)

    // Filter Logic
    const filteredItems = React.useMemo(() => {
        return initialItems.filter(item => {
            if (selectedCategoryId && item.category_id !== selectedCategoryId) return false
            if (selectedCollectionId && item.collection_id !== selectedCollectionId) return false
            return true
        })
    }, [initialItems, selectedCategoryId, selectedCollectionId])

    // Dynamic counts
    const categoryCounts = React.useMemo(() => {
        const counts: Record<string, number> = {}
        const baseItems = selectedCollectionId
            ? initialItems.filter(item => item.collection_id === selectedCollectionId)
            : initialItems
        baseItems.forEach(item => {
            if (item.category_id) {
                counts[item.category_id] = (counts[item.category_id] || 0) + 1
            }
        })
        return counts
    }, [initialItems, selectedCollectionId])

    const collectionCounts = React.useMemo(() => {
        const counts: Record<string, number> = {}
        const baseItems = selectedCategoryId
            ? initialItems.filter(item => item.category_id === selectedCategoryId)
            : initialItems
        baseItems.forEach(item => {
            if (item.collection_id) {
                counts[item.collection_id] = (counts[item.collection_id] || 0) + 1
            }
        })
        return counts
    }, [initialItems, selectedCategoryId])

    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/600x400?text=No+Image'
    }

    return (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-8 flex flex-col md:flex-row gap-12">
            {/* Mobile Filter Bar */}
            <nav className="md:hidden sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-slate-100 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar" aria-label="Catalog filters">
                <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            aria-expanded={isFilterSheetOpen}
                            aria-controls="mobile-filter-drawer"
                            aria-label="Open filters"
                            className="h-11 min-w-[44px] rounded-full px-4 text-xs font-semibold border-slate-300 bg-white shadow-sm flex-shrink-0"
                        >
                            <Filter className="h-4 w-4 mr-2 text-slate-700" aria-hidden="true" />
                            All Filters
                            {(selectedCategoryId || selectedCollectionId) && (
                                <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white" aria-label="Filters active indicator">
                                    {(selectedCategoryId ? 1 : 0) + (selectedCollectionId ? 1 : 0)}
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" id="mobile-filter-drawer" className="h-[80vh] rounded-t-xl px-0">
                        <SheetHeader className="px-6 pb-4 border-b">
                            <SheetTitle className="text-left">Filters</SheetTitle>
                            <SheetDescription className="text-left">
                                Refine your search by category and collection.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="overflow-y-auto h-full px-6 py-6 space-y-8">
                            {/* Categories */}
                            <div>
                                <h3 className="text-[11px] font-bold text-slate-600 tracking-[0.2em] uppercase mb-3 flex items-center justify-between">
                                    Categories
                                    {selectedCategoryId && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedCategoryId(null)}
                                            className="text-[11px] text-slate-700 hover:text-slate-900 transition-colors uppercase font-bold tracking-wide focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none rounded-sm"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </h3>
                                <div className="space-y-1 pl-4">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                                            className={cn(
                                                "w-full text-left min-h-[44px] px-3 text-sm transition-colors flex items-center justify-between group rounded-md focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none",
                                                selectedCategoryId === cat.id
                                                    ? "font-semibold text-slate-900 bg-slate-100"
                                                    : "font-normal text-slate-700 hover:text-slate-900"
                                            )}
                                        >
                                            <span>{cat.name}</span>
                                            <span className={cn("text-xs transition-colors", selectedCategoryId === cat.id ? "text-slate-700" : "text-slate-600 group-hover:text-slate-700")}>
                                                {categoryCounts[cat.id] || 0}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Collections */}
                            <div>
                                <h3 className="text-[11px] font-bold text-slate-600 tracking-[0.2em] uppercase mb-3 flex items-center justify-between">
                                    Collections
                                    {selectedCollectionId && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedCollectionId(null)}
                                            className="text-[11px] text-slate-700 hover:text-slate-900 transition-colors uppercase font-bold tracking-wide focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none rounded-sm"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </h3>
                                <div className="space-y-1 pl-4">
                                    {collections.map(col => (
                                        <button
                                            key={col.id}
                                            type="button"
                                            onClick={() => setSelectedCollectionId(selectedCollectionId === col.id ? null : col.id)}
                                            className={cn(
                                                "w-full text-left min-h-[44px] px-3 text-sm transition-colors flex items-center justify-between group rounded-md focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none",
                                                selectedCollectionId === col.id
                                                    ? "font-semibold text-slate-900 bg-slate-100"
                                                    : "font-normal text-slate-700 hover:text-slate-900"
                                            )}
                                        >
                                            <span>{col.name}</span>
                                            <span className={cn("text-xs transition-colors", selectedCollectionId === col.id ? "text-slate-700" : "text-slate-600 group-hover:text-slate-700")}>
                                                {collectionCounts[col.id] || 0}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </nav>

            {/* Sidebar Filters */}
            <aside className="hidden md:block w-full md:w-56 flex-shrink-0 pt-2 border-r border-slate-50 pr-2" aria-label="Catalog filters">
                {/* Categories */}
                <div className="mb-10">
                    <h3 className="text-[11px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-4 flex items-center justify-between">
                        Categories
                        {selectedCategoryId && (
                            <button
                                type="button"
                                onClick={() => setSelectedCategoryId(null)}
                                className="text-[11px] text-slate-400 hover:text-slate-900 transition-colors uppercase font-bold tracking-wide focus-visible:underline focus-visible:outline-none"
                            >
                                Reset
                            </button>
                        )}
                    </h3>
                    <div className="space-y-1">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                                className={cn(
                                    "w-full text-left py-1 text-xs transition-colors flex items-center justify-between group focus-visible:underline focus-visible:outline-none",
                                    selectedCategoryId === cat.id
                                        ? "font-bold text-slate-900"
                                        : "font-normal text-slate-400 hover:text-slate-900"
                                )}
                                aria-pressed={selectedCategoryId === cat.id}
                            >
                                <span>{cat.name}</span>
                                <span className={cn("text-[10px] transition-colors", selectedCategoryId === cat.id ? "text-slate-900" : "text-slate-300 group-hover:text-slate-400")}>
                                    {categoryCounts[cat.id] || 0}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Collections */}
                <div className="mb-10">
                    <h3 className="text-[11px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-4 flex items-center justify-between">
                        Collections
                        {selectedCollectionId && (
                            <button
                                type="button"
                                onClick={() => setSelectedCollectionId(null)}
                                className="text-[11px] text-slate-400 hover:text-slate-900 transition-colors uppercase font-bold tracking-wide focus-visible:underline focus-visible:outline-none"
                            >
                                Reset
                            </button>
                        )}
                    </h3>
                    <div className="space-y-1">
                        {collections.map(col => (
                            <button
                                key={col.id}
                                type="button"
                                onClick={() => setSelectedCollectionId(selectedCollectionId === col.id ? null : col.id)}
                                className={cn(
                                    "w-full text-left py-1 text-xs transition-colors flex items-center justify-between group focus-visible:underline focus-visible:outline-none",
                                    selectedCollectionId === col.id
                                        ? "font-bold text-slate-900"
                                        : "font-normal text-slate-400 hover:text-slate-900"
                                )}
                                aria-pressed={selectedCollectionId === col.id}
                            >
                                <span>{col.name}</span>
                                <span className={cn("text-[10px] transition-colors hidden group-hover:inline-block", selectedCollectionId === col.id ? "inline-block text-slate-900" : "text-slate-300")}>
                                    {collectionCounts[col.id] || 0}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Grid */}
            <div className="flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
                    {filteredItems.map((item, index) => (
                        <div key={item.id} className="group block">
                            <Link href={`/catalog/${item.id}?context=archive`}>
                                <div className="relative aspect-square bg-white overflow-hidden rounded-sm mb-4">
                                    <Image
                                        src={getImageUrl(item.image_paths)}
                                        alt={item.name}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                        priority={index < 4}
                                    />
                                </div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
                                            {item.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 capitalize">{item.category}</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="text-center py-32">
                        <h3 className="text-lg text-gray-400 font-light">
                            No items found in this selection.
                        </h3>
                    </div>
                )}
            </div>
        </div>
    )
}
