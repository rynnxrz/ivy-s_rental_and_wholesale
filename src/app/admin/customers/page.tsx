import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
    const supabase = await createClient()

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/')

    // 2. Fetch customers (all non-admin users)
    const { data: customers, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, company_name, organization_domain, created_at')
        .neq('role', 'admin')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching customers:', error)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-light text-gray-900">Customers</h1>
                    <p className="text-gray-500 mt-1">Manage your customer database</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-gray-500" />
                        <CardTitle>Customer List</CardTitle>
                    </div>
                    <CardDescription>
                        {customers?.length || 0} customer{(customers?.length || 0) !== 1 ? 's' : ''} registered
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {customers && customers.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Domain</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium">
                                            {customer.full_name || '—'}
                                        </TableCell>
                                        <TableCell>
                                            {customer.email ? (
                                                <Link
                                                    href={`/admin/reservations?customer=${encodeURIComponent(customer.email)}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {customer.email}
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {customer.company_name || '—'}
                                        </TableCell>
                                        <TableCell>
                                            {customer.organization_domain ? (
                                                <Badge variant="secondary" className="font-mono text-xs">
                                                    {customer.organization_domain}
                                                </Badge>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No customers yet</p>
                            <p className="text-sm mt-1">Customers will appear here when they submit booking requests.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
