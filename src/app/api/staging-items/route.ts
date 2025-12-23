"use server"

import { getStagingItemsAction } from '@/actions/items'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')

    if (!batchId) {
        return NextResponse.json({ error: 'Missing batchId' }, { status: 400 })
    }

    const result = await getStagingItemsAction(batchId)

    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ items: result.data ?? [] })
}
