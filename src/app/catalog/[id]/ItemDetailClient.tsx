"use client"

import * as React from "react"
import Link from 'next/link'
import Image from 'next/image'
import { BookingForm } from './BookingForm'
import { ArrowLeft } from 'lucide-react'
import { cn } from "@/lib/utils"

// Define the shape of the Item similar to what page.tsx uses, or import types if available.
// For now inline to match page.tsx structure.
interface Item {
    id: string
    name: string
    category: string
    color?: string | null
    rental_price: number
    replacement_cost: number
    description: string | null
    specs: Record<string, any> | null
    image_paths: string[] | null
    sku: string | null
    status: string
    material?: string | null
    weight?: string | null
}

interface ItemDetailClientProps {
    item: Item
    context?: string
    relatedItemsSlot?: React.ReactNode
}


export function ItemDetailClient({ item, context, relatedItemsSlot }: ItemDetailClientProps) {
    const isArchiveMode = context === 'archive'

    const [selectedImage, setSelectedImage] = React.useState<string | null>(null)

    // Reset selected image when item changes
    React.useEffect(() => {
        setSelectedImage(null)
    }, [item.id])

    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/800x600?text=No+Image'
    }

    const currentImage = selectedImage || getImageUrl(item.image_paths)

    const specs = (item.specs as Record<string, string>) || {}

    // Smart Back Button Logic
    // If archive mode, go to /archive
    // Else go to /catalog (or / if default)
    // User requested: "If from Rental (Catalog), back to /catalog. If from Archive, back to /archive."
    const backHref = isArchiveMode ? '/archive' : '/catalog'
    const backLabel = isArchiveMode ? 'Back to Archive' : 'Back to Collection'

    return (
        <div className="min-h-screen bg-white pb-20">
            {/* Breadcrumb / Back */}
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-6">
                <Link
                    href={backHref}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel}
                </Link>
            </div>

            <main className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-32 md:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-24">

                    {/* Image Side */}
                    <div className="lg:sticky lg:top-24">
                        <div className="relative bg-white w-full h-[40vh] lg:h-auto lg:aspect-square overflow-hidden rounded-md mb-4">
                            <Image
                                src={currentImage}
                                alt={item.name}
                                fill
                                className="object-contain object-center p-8 transition-opacity duration-300"
                                priority
                                sizes="(max-width: 1024px) 100vw, 50vw"
                            />
                        </div>

                        {/* Thumbnails */}
                        {item.image_paths && item.image_paths.length > 1 && (
                            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                {item.image_paths.map((path, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(path)}
                                        className={cn(
                                            "relative w-16 h-16 flex-shrink-0 bg-white rounded-md overflow-hidden border-2 transition-all",
                                            (selectedImage === path || (!selectedImage && idx === 0))
                                                ? "border-black ring-1 ring-black"
                                                : "border-transparent hover:border-slate-300"
                                        )}
                                    >
                                        <Image
                                            src={path}
                                            alt={`${item.name} view ${idx + 1}`}
                                            fill
                                            className="object-cover object-center"
                                            sizes="64px"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Details Side */}
                    <div className="pt-4 lg:pt-0">
                        <div className="border-b border-gray-100 pb-6 mb-6">
                            <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">{item.category}</p>
                            <h1 className="text-3xl lg:text-4xl font-light text-gray-900 mb-4 lg:mb-6">
                                {item.color ? `${item.color} ${item.name}` : item.name}
                            </h1>

                            {/* Price - Only show if NOT in archive mode */}
                            {!isArchiveMode && (
                                <div className="flex items-baseline gap-4">
                                    <p className="text-3xl font-light text-gray-900">
                                        ${item.rental_price}
                                    </p>
                                    <span className="text-gray-500">per day</span>
                                </div>
                            )}
                        </div>

                        {/* Action Area (Booking Form) - Moved Up, Only show if NOT in archive mode */}
                        {!isArchiveMode && (
                            <div className="mb-8">
                                <BookingForm item={item} />
                            </div>
                        )}

                        {/* Description */}
                        <div className="prose prose-gray max-w-none text-gray-600 font-light mb-8">
                            <p>{item.description || 'No description available for this item.'}</p>
                        </div>

                        {/* Specifications - More Compact */}
                        <div className="border-t border-gray-100 pt-6">
                            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
                                Specifications
                            </h3>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                {item.color && (
                                    <div>
                                        <dt className="text-gray-400">Color</dt>
                                        <dd className="text-gray-900">{item.color}</dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-gray-400">SKU</dt>
                                    <dd className="text-gray-900">{item.sku}</dd>
                                </div>
                                {!isArchiveMode && (
                                    <div>
                                        <dt className="text-gray-400">Replacement Value</dt>
                                        <dd className="text-gray-900">${item.replacement_cost}</dd>
                                    </div>
                                )}
                                {item.material && (
                                    <div>
                                        <dt className="text-gray-400">Material</dt>
                                        <dd className="text-gray-900">{item.material}</dd>
                                    </div>
                                )}
                                {item.weight && (
                                    <div>
                                        <dt className="text-gray-400">Weight</dt>
                                        <dd className="text-gray-900">{item.weight}</dd>
                                    </div>
                                )}
                                {Object.entries(specs).map(([key, value]) => (
                                    <div key={key}>
                                        <dt className="text-gray-400">{key}</dt>
                                        <dd className="text-gray-900">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                    </div>
                </div>

                {/* Related Items Section - Injected via Slot */}
                {relatedItemsSlot}
            </main>
        </div>
    )
}
