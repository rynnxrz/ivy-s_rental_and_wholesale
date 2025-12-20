import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-white flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">

      {/* RENTAL */}
      <Link href="/catalog" className="flex-1 group relative flex items-center justify-center min-h-[33vh] md:min-h-screen hover:bg-gray-50 transition-colors duration-500">
        <div className="text-center z-10 p-8">
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.2em] text-gray-900 mb-4 group-hover:scale-110 transition-transform duration-500">RENTAL</h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
            Current Collection
          </p>
        </div>
      </Link>

      {/* WHOLESALE */}
      <Link href="/wholesale" className="flex-1 group relative flex items-center justify-center min-h-[33vh] md:min-h-screen hover:bg-gray-50 transition-colors duration-500">
        <div className="text-center z-10 p-8">
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.2em] text-gray-900 mb-4 group-hover:scale-110 transition-transform duration-500">WHOLESALE</h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
            For Partners
          </p>
        </div>
      </Link>

      {/* ARCHIVE */}
      <Link href="/archive" className="flex-1 group relative flex items-center justify-center min-h-[33vh] md:min-h-screen hover:bg-gray-50 transition-colors duration-500">
        <div className="text-center z-10 p-8">
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.2em] text-gray-900 mb-4 group-hover:scale-110 transition-transform duration-500">ARCHIVE</h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
            Past Collection
          </p>
        </div>
      </Link>

    </main>
  )
}
