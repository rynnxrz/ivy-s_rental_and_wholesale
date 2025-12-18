
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Try to select ONLY the problematic column.
        // Even if no rows exist, this query will error if the column is missing.
        const { data, error } = await supabase
            .from('items')
            .select('replacement_cost')
            .limit(1)

        if (error) {
            return NextResponse.json({
                status: 'error',
                message: 'Column verification failed',
                error
            }, { status: 500 })
        }

        return NextResponse.json({
            status: 'success',
            message: 'Column verification passed: replacement_cost exists',
            data
        })
    } catch (e: any) {
        return NextResponse.json({
            status: 'fatal_error',
            message: e.message
        }, { status: 500 })
    }
}
