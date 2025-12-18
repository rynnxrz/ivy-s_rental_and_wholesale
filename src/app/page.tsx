import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Gem, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="flex flex-col items-center space-y-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur">
          <Gem className="h-10 w-10" />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Ivy&apos;s Rental
          </h1>
          <p className="max-w-md text-lg text-slate-300">
            Premium jewelry rental and wholesale management system for discerning businesses.
          </p>
        </div>

        <div className="flex gap-4">
          <Button asChild size="lg" variant="outline" className="text-slate-900">
            <Link href="/login">
              Admin Login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <footer className="absolute bottom-8 text-sm text-slate-500">
        © 2024 Ivy&apos;s Rental & Wholesale
      </footer>
    </div>
  )
}
