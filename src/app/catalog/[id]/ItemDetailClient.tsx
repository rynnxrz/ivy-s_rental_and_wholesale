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
    specs: Record<string, unknown> | null
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
        return 'https://placehold.co/800x600.png?text=No+Image'
    }

    const currentImage = selectedImage || getImageUrl(item.image_paths)
    const displayName = item.color ? `${item.color} ${item.name}` : item.name

    const specs = (item.specs as Record<string, string>) || {}

    // Smart Back Button Logic
    // If archive mode, go to /archive
    // Else go to /catalog (or / if default)
    // User requested: "If from Rental (Catalog), back to /catalog. If from Archive, back to /archive."
    const backHref = isArchiveMode ? '/archive' : '/catalog'
    const backLabel = isArchiveMode ? 'Back to Archive' : 'Back to Collection'

    return (
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-white pb-20" aria-label={`${displayName} details`}>
            {/* Breadcrumb / Back */}
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-6">
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 transition-colors py-2 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none rounded-md"
                    aria-label={backLabel}
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    {backLabel}
                </Link>
            </div>

            <section className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-32 md:pb-0" aria-label="Jewelry details">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-24">

                    {/* Image Side */}
                    <div className="lg:sticky lg:top-24">
                        <div className="relative bg-white w-full h-[40vh] lg:h-auto lg:aspect-square overflow-hidden rounded-md mb-4">
                            <Image
                                src={currentImage}
                                alt={`${displayName} fine jewelry piece`}
                                fill
                                className="object-contain object-center p-8 transition-opacity duration-300"
                                priority
                                sizes="(max-width: 1024px) 100vw, 50vw"
                            />
                        </div>

                        {/* Thumbnails */}
                        {item.image_paths && item.image_paths.length > 1 && (
                            <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                                {item.image_paths.map((path, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedImage(path)}
                                        aria-label={`View image ${idx + 1} of ${displayName}`}
                                        aria-pressed={selectedImage === path || (!selectedImage && idx === 0)}
                                        className={cn(
                                            "relative w-16 h-16 flex-shrink-0 bg-white rounded-md overflow-hidden border-2 transition-all focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none",
                                            (selectedImage === path || (!selectedImage && idx === 0))
                                                ? "border-slate-900 ring-1 ring-slate-900"
                                                : "border-transparent hover:border-slate-300"
                                        )}
                                    >
                                        <Image
                                            src={path}
                                            alt={`Thumbnail ${idx + 1} of ${displayName}`}
                                            fill
                                            className="object-cover object-center"
                                            sizes="64px"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Content Side */}
                    <div className="lg:mt-8">
                        <div className="mb-2">
                            <span className="text-xs font-semibold tracking-widest text-slate-700 uppercase">
                                {item.category}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-light text-slate-900 mb-6 tracking-tight">
                            {item.name}
                        </h1>

                        <div className="flex items-baseline gap-2 mb-8 border-b border-gray-100 pb-8">
                            {!isArchiveMode && (
                                <>
                                    <span className="text-2xl font-semibold text-slate-900">
                                        ${item.rental_price}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <p className="text-sm font-medium text-slate-700">
                                            / day (min. 10%)
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Action Area (Booking Form) - Moved Up, Only show if NOT in archive mode */}
                        {!isArchiveMode && (
                            <div className="mb-4">
                                <BookingForm item={item} />
                            </div>
                        )}

                        {/* Description */}
                        <div className="prose prose-gray max-w-none text-slate-700 font-normal mb-8">
                            <p>{item.description || 'No description available for this item.'}</p>
                        </div>

                        {/* Specifications - More Compact */}
                        <div className="border-t border-gray-100 pt-6">
                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-4">
                                Specifications
                            </h3>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                {item.color && (
                                    <div>
                                        <dt className="text-slate-700">Color</dt>
                                        <dd className="text-slate-900">{item.color}</dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-slate-700">SKU</dt>
                                    <dd className="text-slate-900">{item.sku}</dd>
                                </div>
                                {!isArchiveMode && (
                                    <div>
                                        <dt className="text-slate-700">Replacement Value</dt>
                                        <dd className="text-slate-900">${item.replacement_cost}</dd>
                                    </div>
                                )}
                                {item.material && (
                                    <div>
                                        <dt className="text-slate-700">Material</dt>
                                        <dd className="text-slate-900">{item.material}</dd>
                                    </div>
                                )}
                                {item.weight && (
                                    <div>
                                        <dt className="text-slate-700">Weight</dt>
                                        <dd className="text-slate-900">{item.weight}</dd>
                                    </div>
                                )}
                                {Object.entries(specs).map(([key, value]) => (
                                    <div key={key}>
                                        <dt className="text-slate-700">{key}</dt>
                                        <dd className="text-slate-900">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                    </div>
                </div>

                {/* Related Items Section - Injected via Slot */}
                {relatedItemsSlot}
            </section>
        </main>
    )
}
