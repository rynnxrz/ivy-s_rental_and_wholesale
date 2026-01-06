import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { RedirectToLogin } from "../../../components/admin/RedirectToLogin"
import { RetryButton } from "./RetryButton"

export default async function ErrorLogsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <RedirectToLogin />

    // Fetch errors
    const { data: errors, error } = await supabase
        .from('system_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) {
        return <div className="p-8 text-red-500">Failed to load system errors: {error.message}</div>
    }

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-gray-900">System Error Logs</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Review and audit backend failures involving email delivery, data sync, or other critical processes.
                </p>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <ul role="list" className="divide-y divide-gray-100">
                    {errors?.map((err) => (
                        <li key={err.id} className="p-6 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {err.resolved ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <AlertTriangle className="h-4 w-4 text-red-500" />
                                        )}
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {err.error_type}
                                        </p>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                            {err.id.slice(0, 8)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono bg-gray-50 p-3 rounded border border-gray-100 overflow-x-auto">
                                        {JSON.stringify(err.payload, null, 2)}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-4 text-xs text-gray-400">
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(err.created_at), 'PPpp')}
                                            </span>
                                            {err.resolved && (
                                                <span>
                                                    Resolved at: {format(new Date(err.resolved_at), 'PPpp')}
                                                </span>
                                            )}
                                        </div>
                                        <RetryButton
                                            errorId={err.id}
                                            retryCount={err.retry_count}
                                            resolved={err.resolved || false}
                                        />
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {(!errors || errors.length === 0) && (
                        <li className="p-12 text-center text-gray-500">
                            No system errors recorded.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    )
}
