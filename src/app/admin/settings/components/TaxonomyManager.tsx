'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { Category, Collection } from '@/types'
import { toggleCategoryVisibility, toggleCollectionVisibility, deleteCategory, deleteCollection, createCategory, createCollection } from '../actions'
import { AlertCircle, Trash2, Plus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'

interface TaxonomyManagerProps {
    categories: Category[]
    collections: Collection[]
}

export default function TaxonomyManager({ categories, collections }: TaxonomyManagerProps) {
    const [error, setError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [newItemName, setNewItemName] = useState('')
    const [dialogOpen, setDialogOpen] = useState<'category' | 'collection' | null>(null)

    const handleCreate = async (type: 'category' | 'collection') => {
        if (!newItemName.trim()) return

        setIsCreating(true)
        setError(null)
        try {
            if (type === 'category') {
                await createCategory(newItemName)
            } else {
                await createCollection(newItemName)
            }
            setDialogOpen(null)
            setNewItemName('')
        } catch (err) {
            setError(`Failed to create ${type}`)
            console.error(err)
        } finally {
            setIsCreating(false)
        }
    }

    const handleCategoryToggle = async (id: string, currentHidden: boolean) => {
        try {
            await toggleCategoryVisibility(id, !currentHidden)
        } catch (err) {
            setError('Failed to update category visibility')
            console.error(err)
        }
    }

    const handleCollectionToggle = async (id: string, currentHidden: boolean) => {
        try {
            await toggleCollectionVisibility(id, !currentHidden)
        } catch (err) {
            setError('Failed to update collection visibility')
            console.error(err)
        }
    }

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete category "${name}"? This action cannot be undone.`)) return
        try {
            await deleteCategory(id)
        } catch (err) {
            setError('Failed to delete category')
            console.error(err)
        }
    }

    const handleDeleteCollection = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete collection "${name}"? This action cannot be undone.`)) return
        try {
            await deleteCollection(id)
        } catch (err) {
            setError('Failed to delete collection')
            console.error(err)
        }
    }

    return (
        <div className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                {/* Categories */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="space-y-1">
                            <CardTitle>Categories</CardTitle>
                            <CardDescription>
                                Manage categories visible in the client portal.
                            </CardDescription>
                        </div>
                        <Dialog open={dialogOpen === 'category'} onOpenChange={(open) => setDialogOpen(open ? 'category' : null)}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Category</DialogTitle>
                                    <DialogDescription>Create a new category for your items.</DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="cat-name" className="mb-2 block">Name</Label>
                                    <Input
                                        id="cat-name"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        placeholder="e.g., Rings"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancel</Button>
                                    <Button onClick={() => handleCreate('category')} disabled={isCreating}>Create</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        {categories.map((category) => (
                            <div key={category.id} className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                                <div className="space-y-0.5 max-w-[200px]">
                                    <Label className="text-base break-words">{category.name}</Label>
                                    <div className="text-sm text-muted-foreground">
                                        {category.hidden_in_portal ? 'Hidden' : 'Visible'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Switch
                                        checked={!category.hidden_in_portal}
                                        onCheckedChange={() => handleCategoryToggle(category.id, category.hidden_in_portal)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteCategory(category.id, category.name)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <p className="text-sm text-muted-foreground">No categories found.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Collections */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="space-y-1">
                            <CardTitle>Collections</CardTitle>
                            <CardDescription>
                                Manage collections visible in the client portal.
                            </CardDescription>
                        </div>
                        <Dialog open={dialogOpen === 'collection'} onOpenChange={(open) => setDialogOpen(open ? 'collection' : null)}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Collection</DialogTitle>
                                    <DialogDescription>Create a new collection for your items.</DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="col-name" className="mb-2 block">Name</Label>
                                    <Input
                                        id="col-name"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        placeholder="e.g., Summer 2024"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancel</Button>
                                    <Button onClick={() => handleCreate('collection')} disabled={isCreating}>Create</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        {collections.map((collection) => (
                            <div key={collection.id} className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                                <div className="space-y-0.5 max-w-[200px]">
                                    <Label className="text-base break-words">{collection.name}</Label>
                                    <div className="text-sm text-muted-foreground">
                                        {collection.hidden_in_portal ? 'Hidden' : 'Visible'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Switch
                                        checked={!collection.hidden_in_portal}
                                        onCheckedChange={() => handleCollectionToggle(collection.id, collection.hidden_in_portal)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteCollection(collection.id, collection.name)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {collections.length === 0 && (
                            <p className="text-sm text-muted-foreground">No collections found.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
