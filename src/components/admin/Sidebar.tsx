'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Package,
    Calendar,
    Users,
    Settings,
    LogOut,
    Gem
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/items', label: 'Items', icon: Package },
    { href: '/admin/reservations', label: 'Reservations', icon: Calendar },
    { href: '/admin/customers', label: 'Customers', icon: Users },
]

export const Sidebar = () => {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <aside className="flex h-screen w-64 flex-col border-r bg-slate-50">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 px-6">
                <Gem className="h-6 w-6 text-slate-700" />
                <span className="text-lg font-semibold text-slate-900">Ivy&apos;s Rental</span>
            </div>

            <Separator />

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/admin' && pathname.startsWith(item.href))

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-slate-200 text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <Separator />

            {/* Footer */}
            <div className="space-y-1 px-3 py-4">
                <Link
                    href="/admin/settings"
                    className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'
                    )}
                >
                    <Settings className="h-4 w-4" />
                    Settings
                </Link>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    onClick={handleSignOut}
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </aside>
    )
}
