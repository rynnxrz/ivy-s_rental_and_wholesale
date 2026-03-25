import { differenceInCalendarDays, formatISO } from 'date-fns'
import { createServiceClient } from '@/lib/supabase/server'
import { RESERVATION_STATUSES, normalizeLegacyReservationStatus } from '@/lib/constants/reservation-status'

const LOCAL_COUNTRIES = new Set([
    'united kingdom',
    'uk',
    'england',
    'scotland',
    'wales',
    'great britain',
])

const HOTEL_REGEX = /\b(hotel|ritz|marriott|hilton|four seasons|sofitel|mandarin|peninsula|rosewood|st\.\s?regis)\b/i
const LATE_RETURN_REGEX = /\b(late|delay|overdue)\b/i

export type ReservationAssessmentRow = {
    id: string
    group_id?: string | null
    renter_id?: string | null
    item_id: string
    status?: string | null
    start_date: string
    end_date: string
    created_at?: string | null
    country?: string | null
    city_region?: string | null
    address_line1?: string | null
    address_line2?: string | null
    event_location?: string | null
    dispatch_notes?: string | null
    admin_notes?: string | null
    return_notes?: string | null
    original_start_date?: string | null
    original_end_date?: string | null
    items?: {
        name?: string | null
        sku?: string | null
        rental_price?: number | null
        replacement_cost?: number | null
    } | null
    profiles?: {
        full_name?: string | null
        email?: string | null
        company_name?: string | null
    } | null
}

export type ReservationGroupAssessment = {
    groupKey: string
    primaryReservationId: string
    renterId: string | null
    statusSnapshot: string
    priorityScore: number
    priorityBand: 'urgent' | 'high' | 'standard' | 'low'
    valueTier: 'vip' | 'high' | 'standard' | 'low'
    feasibilityStatus: 'clear' | 'watch' | 'high_risk'
    riskTags: string[]
    reasons: string[]
    recommendedNextStep: string
    generatedAt: string
    snapshot: {
        riskAssessment: string[]
        feasibilityCheck: string[]
        valueTier: string
        priorityScore: number
        priorityBand: 'urgent' | 'high' | 'standard' | 'low'
        customerSummary: string
    }
}

const ACTIVE_STATUSES = [
    RESERVATION_STATUSES.UPCOMING,
    RESERVATION_STATUSES.ONGOING,
    'confirmed',
    'active',
]

function normalizeCountry(value: string | null | undefined) {
    return (value || '').trim().toLowerCase()
}

function parseRequestNotes(notes: string | null | undefined) {
    const clean = (notes || '').replace(/^Request Notes:\s*/i, '').trim()
    const lines = clean
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)

    const lookup = (prefix: string) => (
        lines.find(line => line.toLowerCase().startsWith(prefix.toLowerCase()))
            ?.split(':')
            .slice(1)
            .join(':')
            .trim() || null
    )

    return {
        raw: clean,
        budget: lookup('Budget'),
        style: lookup('Style'),
        brand: lookup('Brand'),
        logistics: lookup('Logistics'),
        occasion: lookup('Occasion'),
    }
}

function buildCustomerSummary(group: ReservationAssessmentRow[]) {
    const primary = group[0]
    if (!primary) return 'Guest request'

    const pieces = group.map(row => row.items?.name).filter(Boolean).join(', ')
    const customer = primary.profiles?.company_name || primary.profiles?.full_name || primary.profiles?.email || 'Guest'
    return `${customer}${pieces ? ` · ${pieces}` : ''}`
}

function resolveValueTier(totalRetail: number, totalRental: number, itemCount: number): 'vip' | 'high' | 'standard' | 'low' {
    if (totalRetail >= 12000 || totalRental >= 4000 || itemCount >= 4) return 'vip'
    if (totalRetail >= 7000 || totalRental >= 2500 || itemCount >= 3) return 'high'
    if (totalRetail >= 2500 || totalRental >= 900 || itemCount >= 2) return 'standard'
    return 'low'
}

function resolvePriorityBand(score: number): 'urgent' | 'high' | 'standard' | 'low' {
    if (score >= 85) return 'urgent'
    if (score >= 70) return 'high'
    if (score >= 45) return 'standard'
    return 'low'
}

export function buildReservationGroupKey(row: { group_id?: string | null; id: string }) {
    return row.group_id || row.id
}

async function fetchCustomerHistory(renterId: string | null, groupKey: string) {
    if (!renterId) return []
    const supabase = createServiceClient()
    const { data } = await supabase
        .from('reservations')
        .select('id, group_id, status, start_date, end_date, country, admin_notes, return_notes, dispatch_notes')
        .eq('renter_id', renterId)
        .order('created_at', { ascending: false })
        .limit(50)

    return ((data || []) as Array<Record<string, unknown>>).filter(row => buildReservationGroupKey({
        id: String(row.id),
        group_id: typeof row.group_id === 'string' ? row.group_id : null,
    }) !== groupKey)
}

async function fetchNeighboringReservations(group: ReservationAssessmentRow[], bufferDays: number) {
    if (group.length === 0) return []
    const supabase = createServiceClient()
    const itemIds = Array.from(new Set(group.map(row => row.item_id)))
    const earliestStart = new Date(Math.min(...group.map(row => new Date(row.start_date).getTime())))
    const latestEnd = new Date(Math.max(...group.map(row => new Date(row.end_date).getTime())))
    earliestStart.setDate(earliestStart.getDate() - Math.max(bufferDays, 7))
    latestEnd.setDate(latestEnd.getDate() + Math.max(bufferDays, 7))

    const { data } = await supabase
        .from('reservations')
        .select('id, item_id, group_id, status, start_date, end_date, country, city_region, event_location')
        .in('item_id', itemIds)
        .in('status', ACTIVE_STATUSES)
        .lte('start_date', formatISO(latestEnd, { representation: 'date' }))
        .gte('end_date', formatISO(earliestStart, { representation: 'date' }))

    const currentIds = new Set(group.map(row => row.id))
    return ((data || []) as Array<Record<string, unknown>>).filter(row => !currentIds.has(String(row.id)))
}

async function fetchTurnaroundBuffer() {
    const supabase = createServiceClient()
    const { data } = await supabase
        .from('app_settings')
        .select('turnaround_buffer')
        .eq('id', 1)
        .maybeSingle()

    return Math.max(0, Number(data?.turnaround_buffer || 0))
}

export async function deriveReservationGroupAssessment(group: ReservationAssessmentRow[]): Promise<ReservationGroupAssessment | null> {
    const primary = group[0]
    if (!primary) return null

    const groupKey = buildReservationGroupKey(primary)
    const today = new Date()
    const requestNotes = parseRequestNotes(primary.dispatch_notes)
    const totalRental = group.reduce((sum, row) => sum + Number(row.items?.rental_price || 0), 0)
    const totalRetail = group.reduce((sum, row) => sum + Number(row.items?.replacement_cost || row.items?.rental_price || 0), 0)
    const daysUntilStart = differenceInCalendarDays(new Date(primary.start_date), today)
    const valueTier = resolveValueTier(totalRetail, totalRental, group.length)
    const riskTags = new Set<string>()
    const riskAssessment: string[] = []
    const feasibilityCheck: string[] = []
    const reasons: string[] = []

    const [history, bufferDays, neighbors] = await Promise.all([
        fetchCustomerHistory(primary.renter_id || null, groupKey),
        fetchTurnaroundBuffer(),
        fetchNeighboringReservations(group, 0),
    ])

    const normalizedCountry = normalizeCountry(primary.country)
    const crossBorder = Boolean(normalizedCountry && !LOCAL_COUNTRIES.has(normalizedCountry))
    if (crossBorder) {
        riskTags.add('cross_border_logistics')
        riskAssessment.push('首次或跨境履约需要额外确认清关与运输时效。')
    }

    const destinationText = [primary.address_line1, primary.address_line2, primary.event_location].filter(Boolean).join(' ')
    if (HOTEL_REGEX.test(destinationText)) {
        riskTags.add('non_fixed_destination')
        riskAssessment.push('收件地看起来像酒店或临时场所，建议确认签收安排。')
    }

    const hasLateHistory = history.some(row => LATE_RETURN_REGEX.test(String(row.return_notes || row.admin_notes || '')))
    if (hasLateHistory) {
        riskTags.add('late_return_history')
        riskAssessment.push('客户历史记录里出现过延迟归还提示。')
    }

    if (daysUntilStart <= 5) {
        riskTags.add('tight_timeline')
        riskAssessment.push('使用日期很近，留给确认与履约的时间偏紧。')
    }

    if (totalRetail >= 12000 || group.length >= 4) {
        riskTags.add('high_value_logistics')
        riskAssessment.push('本单件数或作品价值较高，建议优先核对物流与保险安排。')
    }

    let feasibilityStatus: ReservationGroupAssessment['feasibilityStatus'] = 'clear'
    const supabase = createServiceClient()
    for (const row of group) {
        const { data: available } = await supabase.rpc('check_item_availability', {
            p_item_id: row.item_id,
            p_start_date: row.start_date,
            p_end_date: row.end_date,
            p_exclude_reservation_id: row.id,
        })

        if (available === false) {
            feasibilityStatus = 'high_risk'
            riskTags.add('inventory_conflict')
            const itemLabel = row.items?.name || '该作品'
            feasibilityCheck.push(`${itemLabel} 在所选日期已有冲突档期。`)
            break
        }
    }

    if (feasibilityStatus !== 'high_risk') {
        for (const neighbor of neighbors) {
            const matchingRequest = group.find(row => row.item_id === String(neighbor.item_id))
            if (!matchingRequest) continue

            const gapAfterPrevious = differenceInCalendarDays(new Date(matchingRequest.start_date), new Date(String(neighbor.end_date)))
            if (gapAfterPrevious >= 0 && gapAfterPrevious <= Math.max(bufferDays, 2)) {
                feasibilityStatus = gapAfterPrevious <= 1 ? 'high_risk' : 'watch'
                riskTags.add('tight_turnaround')
                feasibilityCheck.push(
                    `${matchingRequest.items?.name || '该作品'} 在 ${neighbor.end_date} 才结束上一单，距离本次开始只有 ${gapAfterPrevious} 天缓冲。`
                )
                if (normalizeCountry(neighbor.country as string | null | undefined) !== normalizedCountry && normalizedCountry) {
                    riskTags.add('cross_city_turnaround')
                    feasibilityCheck.push('前一单与本次使用地不同，建议额外确认跨城或跨境运输时长。')
                }
                break
            }
        }
    }

    if (feasibilityCheck.length === 0) {
        feasibilityCheck.push('当前库存与时间窗口没有发现直接冲突。')
    }

    const previousOrders = new Set(history.map(row => buildReservationGroupKey({
        id: String(row.id),
        group_id: typeof row.group_id === 'string' ? row.group_id : null,
    }))).size

    let priorityScore = 38
    priorityScore += valueTier === 'vip' ? 28 : valueTier === 'high' ? 20 : valueTier === 'standard' ? 12 : 4
    priorityScore += previousOrders >= 3 ? 12 : previousOrders >= 1 ? 6 : 0
    priorityScore += daysUntilStart <= 3 ? 15 : daysUntilStart <= 7 ? 10 : daysUntilStart <= 14 ? 5 : 0
    priorityScore += feasibilityStatus === 'high_risk' ? 12 : feasibilityStatus === 'watch' ? 6 : 0
    priorityScore += crossBorder ? 6 : 0
    priorityScore = Math.max(10, Math.min(99, priorityScore))

    if (requestNotes.budget) {
        reasons.push(`预算线索：${requestNotes.budget}`)
    }
    if (requestNotes.style) {
        reasons.push(`风格偏好：${requestNotes.style}`)
    }
    if (requestNotes.brand) {
        reasons.push(`品牌偏好：${requestNotes.brand}`)
    }

    if (reasons.length === 0) {
        reasons.push(
            valueTier === 'vip' || valueTier === 'high'
                ? '本单价值较高，建议优先处理。'
                : '这是标准优先级请求，可按常规节奏跟进。'
        )
    }

    const recommendedNextStep = feasibilityStatus === 'high_risk'
        ? '先核对档期与物流缓冲，再决定是否推进。'
        : feasibilityStatus === 'watch'
            ? '建议先确认收件地与运输窗口。'
            : '可继续由 Ivy 审核作品选择与客户细节。'

    const assessment: ReservationGroupAssessment = {
        groupKey,
        primaryReservationId: primary.id,
        renterId: primary.renter_id || null,
        statusSnapshot: normalizeLegacyReservationStatus(primary.status),
        priorityScore,
        priorityBand: resolvePriorityBand(priorityScore),
        valueTier,
        feasibilityStatus,
        riskTags: Array.from(riskTags),
        reasons: reasons.slice(0, 3),
        recommendedNextStep,
        generatedAt: new Date().toISOString(),
        snapshot: {
            riskAssessment: riskAssessment.length > 0 ? riskAssessment : ['当前没有发现需要额外升级的客户风险信号。'],
            feasibilityCheck,
            valueTier,
            priorityScore,
            priorityBand: resolvePriorityBand(priorityScore),
            customerSummary: buildCustomerSummary(group),
        },
    }

    return assessment
}

export async function ensureReservationGroupAssessment(group: ReservationAssessmentRow[]) {
    const assessment = await deriveReservationGroupAssessment(group)
    if (!assessment) return null
    await upsertReservationGroupAssessment(assessment)
    return assessment
}

export async function upsertReservationGroupAssessment(assessment: ReservationGroupAssessment) {
    const supabase = createServiceClient()
    const { error } = await supabase
        .from('reservation_group_assessments')
        .upsert({
            group_key: assessment.groupKey,
            primary_reservation_id: assessment.primaryReservationId,
            renter_id: assessment.renterId,
            status_snapshot: assessment.statusSnapshot,
            priority_score: assessment.priorityScore,
            priority_band: assessment.priorityBand,
            value_tier: assessment.valueTier,
            feasibility_status: assessment.feasibilityStatus,
            risk_tags: assessment.riskTags,
            reasons: assessment.reasons,
            recommended_next_step: assessment.recommendedNextStep,
            snapshot: assessment.snapshot,
            source_version: 1,
            generated_at: assessment.generatedAt,
        }, {
            onConflict: 'group_key',
        })

    if (error) {
        throw error
    }

    return assessment
}

export async function fetchReservationGroupAssessments(groupKeys: string[]) {
    if (groupKeys.length === 0) return new Map<string, ReservationGroupAssessment>()

    const supabase = createServiceClient()
    const { data } = await supabase
        .from('reservation_group_assessments')
        .select('*')
        .in('group_key', groupKeys)

    const map = new Map<string, ReservationGroupAssessment>()
    for (const row of (data || []) as Array<Record<string, unknown>>) {
        map.set(String(row.group_key), {
            groupKey: String(row.group_key),
            primaryReservationId: String(row.primary_reservation_id),
            renterId: typeof row.renter_id === 'string' ? row.renter_id : null,
            statusSnapshot: String(row.status_snapshot || RESERVATION_STATUSES.PENDING_REQUEST),
            priorityScore: Number(row.priority_score || 0),
            priorityBand: (row.priority_band as ReservationGroupAssessment['priorityBand']) || 'standard',
            valueTier: (row.value_tier as ReservationGroupAssessment['valueTier']) || 'standard',
            feasibilityStatus: (row.feasibility_status as ReservationGroupAssessment['feasibilityStatus']) || 'watch',
            riskTags: Array.isArray(row.risk_tags) ? row.risk_tags.map(String) : [],
            reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
            recommendedNextStep: String(row.recommended_next_step || ''),
            generatedAt: String(row.generated_at || new Date().toISOString()),
            snapshot: (row.snapshot as ReservationGroupAssessment['snapshot']) || {
                riskAssessment: [],
                feasibilityCheck: [],
                valueTier: 'standard',
                priorityScore: Number(row.priority_score || 0),
                priorityBand: 'standard',
                customerSummary: '',
            },
        })
    }

    return map
}
