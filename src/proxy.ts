import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
    // Block direct access to wholesale mode without the auth cookie
    const mode = request.nextUrl.searchParams.get('mode')
    const isWholesaleCatalog = request.nextUrl.pathname.startsWith('/catalog') && mode === 'wholesale'
    const hasWholesaleCookie = request.cookies.get('wholesale_authenticated')?.value === 'true'

    if (isWholesaleCatalog && !hasWholesaleCookie) {
        const url = request.nextUrl.clone()
        url.pathname = '/wholesale'
        url.search = ''
        return NextResponse.redirect(url)
    }

    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
