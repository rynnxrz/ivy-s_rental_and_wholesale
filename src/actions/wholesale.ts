'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const WHOLESALE_AUTH_COOKIE = 'wholesale_authenticated'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

export async function verifyWholesalePassword(password: string): Promise<{ success: boolean; error?: string }> {
    if (!password || password.trim() === '') {
        return { success: false, error: 'Please enter a password' }
    }

    const supabase = createServiceClient()

    const { data: settings, error } = await supabase
        .from('app_settings')
        .select('booking_password')
        .single()

    if (error) {
        console.error('Failed to fetch settings:', error)
        return { success: false, error: 'Server error. Please try again.' }
    }

    const requiredPassword = settings?.booking_password

    if (!requiredPassword || requiredPassword.trim() === '') {
        // No password required, allow access
        const cookieStore = await cookies()
        cookieStore.set(WHOLESALE_AUTH_COOKIE, 'true', {
            maxAge: COOKIE_MAX_AGE,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        })
        return { success: true }
    }

    if (password !== requiredPassword) {
        return { success: false, error: 'Incorrect password. Please try again.' }
    }

    // Password correct, set auth cookie
    const cookieStore = await cookies()
    cookieStore.set(WHOLESALE_AUTH_COOKIE, 'true', {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    })

    return { success: true }
}

export async function checkWholesaleAuth(): Promise<boolean> {
    const cookieStore = await cookies()
    const authCookie = cookieStore.get(WHOLESALE_AUTH_COOKIE)
    return authCookie?.value === 'true'
}

export async function logoutWholesale(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(WHOLESALE_AUTH_COOKIE)
}
