import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'

// Force dynamic rendering to ensure we always get latest items
export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()

  const { data: items, error } = await supabase
    .from('items')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching items:', error)
    return <div className="p-8 text-center text-red-500">Failed to load items. Please try again later.</div>
  }

  // Placeholder image if none provided
  const getImageUrl = (images: string[] | null) => {
    if (images && images.length > 0) return images[0]
    return 'https://placehold.co/600x400?text=No+Image'
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="py-20 px-8 text-center bg-gray-50 border-b border-gray-100">
        <h1 className="text-4xl md:text-5xl font-light tracking-tight text-gray-900 mb-4">
          The Collection
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Curated luxury rentals for your special occasions.
        </p>
      </section>

      {/* Grid Section */}
      <section className="max-w-[1600px] mx-auto px-4 sm:px-8 py-12">
        {items && items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
            {items.map((item) => (
              <Link
                href={`/catalog/${item.id}`}
                key={item.id}
                className="group block"
              >
                <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden rounded-sm mb-4">
                  <Image
                    src={getImageUrl(item.image_paths)}
                    alt={item.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  {item.status !== 'active' && (
                    <div className="absolute top-2 right-2 bg-gray-900 text-white text-xs px-2 py-1 uppercase tracking-wider">
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
                  <p className="text-lg font-light text-gray-900">
                    ${item.rental_price} <span className="text-xs text-gray-400">/day</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-32">
            <h3 className="text-xl text-gray-400 font-light">
              No items in the collection yet.
            </h3>
            <Link
              href="/admin/items/new"
              className="inline-block mt-4 text-sm text-black underline underline-offset-4 hover:text-gray-600"
            >
              Admin: Add your first item
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
