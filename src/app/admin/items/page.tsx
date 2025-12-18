import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Plus, Edit, Package } from 'lucide-react'
import type { Item } from '@/types/database.types'
import { DeleteItemButton } from './DeleteItemButton'

const statusVariant = (status: Item['status']) => {
    switch (status) {
        case 'active':
            return 'default'
        case 'maintenance':
            return 'secondary'
        case 'retired':
            return 'outline'
        default:
            return 'default'
    }
}

export default async function ItemsPage() {
    const supabase = await createClient()

    const { data: items, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching items:', error)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Items</h1>
                    <p className="text-slate-600">Manage your rental inventory</p>
                </div>
                <Button asChild>
                    <Link href="/admin/items/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Item
                    </Link>
                </Button>
            </div>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Inventory</CardTitle>
                    <CardDescription>
                        {items?.length ?? 0} items in catalog
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {items && items.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">Image</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Rental Price</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            {item.image_paths && item.image_paths.length > 0 ? (
                                                <Image
                                                    src={item.image_paths[0]}
                                                    alt={item.name}
                                                    width={40}
                                                    height={40}
                                                    className="rounded-md object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100">
                                                    <Package className="h-4 w-4 text-slate-400" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-slate-600">{item.category ?? '-'}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${item.rental_price.toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariant(item.status)}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/admin/items/${item.id}/edit`}>
                                                        <Edit className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                <DeleteItemButton itemId={item.id} itemName={item.name} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Package className="h-12 w-12 text-slate-300" />
                            <h3 className="mt-4 text-lg font-semibold text-slate-900">No items yet</h3>
                            <p className="mt-1 text-sm text-slate-600">
                                Get started by adding your first item to the catalog.
                            </p>
                            <Button asChild className="mt-4">
                                <Link href="/admin/items/new">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item
                                </Link>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
