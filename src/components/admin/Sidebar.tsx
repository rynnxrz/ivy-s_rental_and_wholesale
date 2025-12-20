'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Package,
    Calendar,
    Users,
    Settings,
    LogOut,
    Gem,
    PanelLeftClose,
    PanelLeftOpen
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
    const [isCollapsed, setIsCollapsed] = useState(false)

    // Persist collapsed state
    useEffect(() => {
        const saved = localStorage.getItem('sidebar-collapsed')
        if (saved !== null) {
            setIsCollapsed(saved === 'true')
        }
    }, [])

    const toggleCollapse = () => {
        const newState = !isCollapsed
        setIsCollapsed(newState)
        localStorage.setItem('sidebar-collapsed', String(newState))
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <aside
            className={cn(
                'relative flex h-screen flex-col border-r bg-slate-50 transition-all duration-300',
                isCollapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo */}
            <div className={cn(
                'flex h-16 items-center gap-2 overflow-hidden',
                isCollapsed ? 'justify-center px-2' : 'px-6'
            )}>
                <Gem className="h-6 w-6 flex-shrink-0 text-slate-700" />
                {!isCollapsed && (
                    <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
                        Ivy&apos;s Rental
                    </span>
                )}
            </div>

            <Separator />

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-2 py-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/admin' && pathname.startsWith(item.href))

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                'flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                                isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                                isActive
                                    ? 'bg-slate-200 text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            )}
                        >
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            {!isCollapsed && <span>{item.label}</span>}
                        </Link>
                    )
                })}
            </nav>

            <Separator />

            {/* Footer */}
            <div className="space-y-1 px-2 py-4">
                <Link
                    href="/admin/settings"
                    title={isCollapsed ? 'Settings' : undefined}
                    className={cn(
                        'flex items-center rounded-lg py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900',
                        isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
                    )}
                >
                    <Settings className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && <span>Settings</span>}
                </Link>
                <Button
                    variant="ghost"
                    title={isCollapsed ? 'Sign Out' : undefined}
                    className={cn(
                        'w-full py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        isCollapsed ? 'justify-center px-2' : 'justify-start gap-3 px-3'
                    )}
                    onClick={handleSignOut}
                >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && <span>Sign Out</span>}
                </Button>

                <Separator className="my-2" />

                {/* Sidebar Toggle */}
                <Button
                    variant="ghost"
                    title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    className={cn(
                        'w-full py-2 text-sm font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-900',
                        isCollapsed ? 'justify-center px-2' : 'justify-start gap-3 px-3'
                    )}
                    onClick={toggleCollapse}
                >
                    {isCollapsed ? (
                        <PanelLeftOpen className="h-4 w-4 flex-shrink-0" />
                    ) : (
                        <PanelLeftClose className="h-4 w-4 flex-shrink-0" />
                    )}
                    {!isCollapsed && <span>Collapse Sidebar</span>}
                </Button>
            </div>
        </aside>
    )
}

