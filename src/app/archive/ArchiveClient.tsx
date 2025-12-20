"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface Item {
    id: string
    name: string
    category: string
    rental_price: number
    image_paths: string[] | null
    status: string
}

interface ArchiveClientProps {
    initialItems: Item[]
}

export function ArchiveClient({ initialItems }: ArchiveClientProps) {
    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/600x400?text=No+Image'
    }

    return (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
                {initialItems.map((item, index) => (
                    <div key={item.id} className="group block">
                        {/* 
                           For Archive, do we even need links? 
                           If there is a detail page, good. If detail page is also rental-focused, maybe we need to be careful.
                           Assuming /catalog/[id] is the detail page. If user goes there, they might see rental stuff.
                           But for the gallery itself, we remove interactions.
                           I'll keep the link to detail page because usually "display info" implies seeing more details.
                        */}
                        <Link href={`/catalog/${item.id}?context=archive`}>
                            <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden rounded-sm mb-4">
                                <Image
                                    src={getImageUrl(item.image_paths)}
                                    alt={item.name}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                    priority={index < 4}
                                />
                                {item.status !== 'active' && (
                                    <div className="absolute top-2 left-2 bg-gray-900/80 text-white text-xs px-2 py-1 rounded-sm uppercase tracking-wider">
                                        {item.status}
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
                                    {/* Displaying price as value reference, even if not renting */}
                                    <p className="text-lg font-light text-gray-900">
                                        ${item.rental_price}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>

            {initialItems.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                    No items found in the archive.
                </div>
            )}
        </div>
    )
}
