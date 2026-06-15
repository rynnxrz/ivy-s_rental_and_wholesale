'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type MembershipRow = {
    organization_id: string
    role: string
    organizations: {
        slug: string
        name?: string | null
    } | null
}

export type PostLoginWorkspaceResult =
    | { ok: true; target: string }
    | { ok: false; error: string }

export type WorkspaceListResult =
    | {
          ok: true
          memberships: Array<{
              organization_id: string
              role: string
              organizations: {
                  slug: string
                  name: string
              }
          }>
          lastActiveOrgId: string | null
      }
    | { ok: false; error: string; reason?: 'unauthenticated' }

export async function resolvePostLoginWorkspaceAction(input: {
    orgHint?: string | null
    nextHint?: string | null
}): Promise<PostLoginWorkspaceResult> {
    const cookieClient = await createClient()
    const {
        data: { user },
        error: userError,
    } = await cookieClient.auth.getUser()
    if (userError || !user) {
        return { ok: false, error: 'You must be signed in.' }
    }

    const memberships = await getMembershipsForUser(user.id)
    if (!memberships.ok) {
        return { ok: false, error: memberships.error }
    }

    const rows = memberships.rows
    const orgHint = normaliseSlug(input.orgHint)
    const nextHint = normaliseNext(input.nextHint)

    if (orgHint) {
        const hinted = rows.find((row) => row.organizations?.slug === orgHint)
        if (hinted?.organizations?.slug) {
            return activateAndTarget(cookieClient, user, hinted, nextHint)
        }
    }

    if (rows.length === 0) {
        return { ok: true, target: '/admin' }
    }

    if (rows.length === 1) {
        return activateAndTarget(cookieClient, user, rows[0], nextHint)
    }

    const target = nextHint
        ? `/select-workspace?next=${encodeURIComponent(nextHint)}`
        : '/select-workspace'
    return { ok: true, target }
}

export async function listWorkspacesForCurrentUserAction(): Promise<WorkspaceListResult> {
    const cookieClient = await createClient()
    const {
        data: { user },
        error: userError,
    } = await cookieClient.auth.getUser()
    if (userError || !user) {
        return { ok: false, error: 'You must be signed in.', reason: 'unauthenticated' }
    }

    const memberships = await getMembershipsForUser(user.id)
    if (!memberships.ok) {
        return { ok: false, error: memberships.error }
    }

    const service = createServiceClient()
    const { data: profile } = await service
        .from('profiles')
        .select('last_active_org_id')
        .eq('id', user.id)
        .maybeSingle()

    return {
        ok: true,
        memberships: memberships.rows
            .filter((row) => row.organizations?.slug)
            .map((row) => ({
                organization_id: row.organization_id,
                role: row.role,
                organizations: {
                    slug: row.organizations?.slug ?? '',
                    name: row.organizations?.name ?? row.organizations?.slug ?? 'Workspace',
                },
            })),
        lastActiveOrgId:
            (profile as { last_active_org_id?: string | null } | null)?.last_active_org_id ?? null,
    }
}

async function getMembershipsForUser(
    userId: string,
): Promise<{ ok: true; rows: MembershipRow[] } | { ok: false; error: string }> {
    const service = createServiceClient()
    const { data, error } = await service
        .from('organization_members')
        .select('organization_id, role, organizations!inner(slug, name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

    if (error) {
        return { ok: false, error: error.message }
    }

    return { ok: true, rows: (data ?? []) as unknown as MembershipRow[] }
}

async function activateAndTarget(
    cookieClient: SupabaseClient,
    user: User,
    membership: MembershipRow,
    nextHint: string | null,
): Promise<PostLoginWorkspaceResult> {
    const slug = membership.organizations?.slug
    if (!slug) {
        return { ok: false, error: 'Workspace has no slug; please contact support.' }
    }

    const activate = await activateWorkspace(cookieClient, user, membership)
    if (!activate.ok) {
        return activate
    }

    const target = isSafeNextForSlug(nextHint, slug) ? (nextHint as string) : `/${slug}/admin`
    return { ok: true, target }
}

async function activateWorkspace(
    cookieClient: SupabaseClient,
    user: User,
    membership: MembershipRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const service = createServiceClient()

    const { error: profileError } = await service
        .from('profiles')
        .update({ last_active_org_id: membership.organization_id })
        .eq('id', user.id)
    if (profileError) {
        return { ok: false, error: profileError.message }
    }

    const { error: stampError } = await service.auth.admin.updateUserById(user.id, {
        app_metadata: {
            ...(user.app_metadata ?? {}),
            current_org_id: membership.organization_id,
            current_org_role: membership.role,
        },
    })
    if (stampError) {
        return { ok: false, error: stampError.message }
    }

    const { error: refreshError } = await cookieClient.auth.refreshSession()
    if (refreshError) {
        return { ok: false, error: refreshError.message }
    }

    return { ok: true }
}

function normaliseSlug(value: string | null | undefined): string | null {
    const trimmed = value?.trim().toLowerCase()
    return trimmed ? trimmed : null
}

function normaliseNext(value: string | null | undefined): string | null {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

function isSafeNextForSlug(next: string | null, slug: string): boolean {
    if (!next) return false
    if (!next.startsWith('/')) return false
    if (next.startsWith('//')) return false
    return next === `/${slug}` || next.startsWith(`/${slug}/`)
}
