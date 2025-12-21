"use client"

import Link from 'next/link'
import Image from 'next/image'
import { BookingForm } from './BookingForm'
import { ArrowLeft } from 'lucide-react'

// Define the shape of the Item similar to what page.tsx uses, or import types if available.
// For now inline to match page.tsx structure.
interface Item {
    id: string
    name: string
    category: string
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

    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/800x600?text=No+Image'
    }

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
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8">
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
                    <div className="relative bg-white w-full h-[45vh] lg:h-auto lg:aspect-square overflow-hidden lg:sticky lg:top-24">
                        <Image
                            src={getImageUrl(item.image_paths)}
                            alt={item.name}
                            fill
                            className="object-contain object-center"
                            priority
                            sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                    </div>

                    {/* Details Side */}
                    <div className="pt-4 lg:pt-0">
                        <div className="border-b border-gray-100 pb-6 mb-6">
                            <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">{item.category}</p>
                            <h1 className="text-3xl lg:text-4xl font-light text-gray-900 mb-4 lg:mb-6">{item.name}</h1>

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

                        <div className="prose prose-gray max-w-none text-gray-600 font-light mb-12">
                            <p>{item.description || 'No description available for this item.'}</p>
                        </div>

                        {/* Specifications */}
                        <div className="bg-gray-50 p-5 md:p-8 rounded-sm">
                            <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider mb-6">
                                Specifications
                            </h3>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                                <div className="border-b border-gray-200 pb-2">
                                    <dt className="text-xs text-gray-500 uppercase">SKU</dt>
                                    <dd className="text-sm text-gray-900 mt-1">{item.sku}</dd>
                                </div>
                                {/** Only show replacement value if NOT in archive mode? 
                                     User said: "Hide all rental related elements: price, date picker... Only keep name, description, specs and image".
                                     Replacement value is kind of a spec, but also financial. 
                                     I'll hide it to be safe as per "Hide all rental related elements". 
                                 */}
                                {!isArchiveMode && (
                                    <div className="border-b border-gray-200 pb-2">
                                        <dt className="text-xs text-gray-500 uppercase">Replacement Value</dt>
                                        <dd className="text-sm text-gray-900 mt-1">${item.replacement_cost}</dd>
                                    </div>
                                )}

                                {item.material && (
                                    <div className="border-b border-gray-200 pb-2">
                                        <dt className="text-xs text-gray-500 uppercase">Material</dt>
                                        <dd className="text-sm text-gray-900 mt-1">{item.material}</dd>
                                    </div>
                                )}

                                {item.weight && (
                                    <div className="border-b border-gray-200 pb-2">
                                        <dt className="text-xs text-gray-500 uppercase">Weight</dt>
                                        <dd className="text-sm text-gray-900 mt-1">{item.weight}</dd>
                                    </div>
                                )}

                                {Object.entries(specs).map(([key, value]) => (
                                    <div key={key} className="border-b border-gray-200 pb-2">
                                        <dt className="text-xs text-gray-500 uppercase">{key}</dt>
                                        <dd className="text-sm text-gray-900 mt-1">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        {/* Action Area (Booking Form) - Only show if NOT in archive mode */}
                        {!isArchiveMode && (
                            <div className="mt-12 bg-white rounded-sm">
                                <BookingForm item={item} />
                            </div>
                        )}

                    </div>
                </div>

                {/* Related Items Section - Injected via Slot */}
                {relatedItemsSlot}
            </main>
        </div>
    )
}
