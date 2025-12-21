import { Sidebar } from '@/components/admin/Sidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log('[AdminLayout] No user found, redirecting to login')
        redirect('/login')
    }

    // Check if user is admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        console.log('[AdminLayout] User is not admin, redirecting')
        redirect('/')
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <Sidebar />

            {/* 
              Desktop: Sidebar is fixed w-16, so main needs pl-16. 
              Mobile: Sidebar is hidden (Sheet), so main is full width.
            */}
            <main className="min-h-screen w-full md:pl-16 transition-[padding] duration-300">
                <div className="p-4 md:p-8 pt-16 md:pt-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
