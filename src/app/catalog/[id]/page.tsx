import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface Props {
    params: Promise<{ id: string }>
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function ItemDetailPage({ params }: Props) {
    const { id } = await params
    const supabase = await createClient()

    const { data: item, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !item) {
        notFound()
    }

    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/800x600?text=No+Image'
    }

    // Cast specs to Record<string, string> for rendering
    const specs = item.specs as Record<string, string> || {}

    return (
        <div className="min-h-screen bg-white pb-20">
            {/* Breadcrumb / Back */}
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8">
                <Link href="/" className="text-sm text-gray-500 hover:text-black transition-colors">
                    ← Back to Collection
                </Link>
            </div>

            <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">

                    {/* Image Side */}
                    <div className="relative aspect-[3/4] bg-gray-50 rounded-sm overflow-hidden">
                        <Image
                            src={getImageUrl(item.image_paths)}
                            alt={item.name}
                            fill
                            className="object-cover"
                            priority
                            sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                    </div>

                    {/* Details Side */}
                    <div className="pt-8 lg:pt-0">
                        <div className="border-b border-gray-100 pb-8 mb-8">
                            <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">{item.category}</p>
                            <h1 className="text-4xl font-light text-gray-900 mb-6">{item.name}</h1>
                            <div className="flex items-baseline gap-4">
                                <p className="text-3xl font-light text-gray-900">
                                    ${item.rental_price}
                                </p>
                                <span className="text-gray-500">per day</span>
                            </div>
                        </div>

                        <div className="prose prose-gray max-w-none text-gray-600 font-light mb-12">
                            <p>{item.description || 'No description available for this item.'}</p>
                        </div>

                        {/* Specifications */}
                        <div className="bg-gray-50 p-6 md:p-8 rounded-sm">
                            <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider mb-6">
                                Specifications
                            </h3>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                                <div className="border-b border-gray-200 pb-2">
                                    <dt className="text-xs text-gray-500 uppercase">SKU</dt>
                                    <dd className="text-sm text-gray-900 mt-1">{item.sku}</dd>
                                </div>
                                <div className="border-b border-gray-200 pb-2">
                                    <dt className="text-xs text-gray-500 uppercase">Replacement Value</dt>
                                    <dd className="text-sm text-gray-900 mt-1">${item.replacement_cost}</dd>
                                </div>

                                {Object.entries(specs).map(([key, value]) => (
                                    <div key={key} className="border-b border-gray-200 pb-2">
                                        <dt className="text-xs text-gray-500 uppercase">{key}</dt>
                                        <dd className="text-sm text-gray-900 mt-1">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        {/* Action Area (Future) */}
                        <div className="mt-12 p-6 border border-gray-200 rounded-sm text-center">
                            <p className="text-gray-500 mb-4">Interested in renting this piece?</p>
                            <button
                                className="w-full bg-black text-white py-4 px-8 uppercase tracking-widest hover:bg-gray-800 transition-colors"
                                disabled
                            >
                                Check Availability (In Milestone 2)
                            </button>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    )
}
