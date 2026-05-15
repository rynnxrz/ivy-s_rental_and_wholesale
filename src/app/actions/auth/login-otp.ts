'use server'

import { createClient } from '@/lib/supabase/server'
import { getOriginAsync } from '@/app/actions/auth/signup'

/**
 * OTP-based login for returning users.
 *
 * Distinct from signup-otp.ts:
 *   - `shouldCreateUser: false` — refuse to create a new account
 *   - no org provisioning on verify — user already has memberships
 *   - no `requested_slug` / `store_name` metadata to carry
 *
 * Flow:
 *   1. `requestLoginOtpAction({ email })` — Supabase emails a 6-digit code.
 *   2. `verifyLoginOtpAction({ email, code })` — verifyOtp + refreshSession.
 *   3. Client runs the existing multi-org redirect logic on `/login`.
 *
 * The login page UI defaults to OTP; password is collapsed behind a
 * "Sign in with password instead" link.
 */

const OTP_TTL_MS = 5 * 60 * 1000

export interface RequestLoginOtpInput {
    email: string
}

export type RequestLoginOtpResult =
    | { ok: true; expiresAt: string }
    | { ok: false; error: string; field?: 'email' }

export interface VerifyLoginOtpInput {
    email: string
    code: string
}

export type VerifyLoginOtpResult =
    | { ok: true; userId: string }
    | { ok: false; error: string; field?: 'code' | 'email' }

export async function requestLoginOtpAction(
    input: RequestLoginOtpInput,
): Promise<RequestLoginOtpResult> {
    const email = (input.email ?? '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: 'Invalid email address.', field: 'email' }
    }

    const origin = await getOriginAsync()

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: false,
            emailRedirectTo: `${origin}/auth/callback?next=/`,
        },
    })

    if (error) {
        // Supabase phrases "Signups not allowed for otp" when
        // shouldCreateUser=false but no user matches. Surface a clearer
        // message so the user can self-serve.
        const msg = error.message
        if (/signups not allowed/i.test(msg) || /user.*not.*found/i.test(msg)) {
            return {
                ok: false,
                error: 'No account with that email. Sign up first.',
                field: 'email',
            }
        }
        return { ok: false, error: msg, field: 'email' }
    }

    return {
        ok: true,
        expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    }
}

export async function verifyLoginOtpAction(
    input: VerifyLoginOtpInput,
): Promise<VerifyLoginOtpResult> {
    const email = (input.email ?? '').trim().toLowerCase()
    const code = (input.code ?? '').trim()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: 'Invalid email address.', field: 'email' }
    }
    if (!/^\d{6}$/.test(code)) {
        return {
            ok: false,
            error: 'Please enter the 6-digit code from your email.',
            field: 'code',
        }
    }

    const supabase = await createClient()
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
    })

    if (verifyError) {
        const msg = verifyError.message
        if (/expired|invalid/i.test(msg)) {
            return {
                ok: false,
                error: 'That code is invalid or has expired. Request a new one.',
                field: 'code',
            }
        }
        return { ok: false, error: msg, field: 'code' }
    }

    const user = data.user
    if (!user?.id) {
        return {
            ok: false,
            error: 'Verification succeeded but no user was returned. Please retry.',
        }
    }

    // Refresh so app_metadata.current_org_id (from the 00054 hook) is
    // present on the next SSR request.
    await supabase.auth.refreshSession().catch(() => {})

    return { ok: true, userId: user.id }
}
