'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, X, Plus, CheckCircle2, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { createItem, updateItem, uploadItemImage, createCategory, createCollection } from '@/actions/items'
import type { Item, ItemSpecs, ITEM_STATUS_OPTIONS } from '@/types'
import { toast } from 'sonner'

const itemSchema = z.object({
    sku: z.string().min(1, 'SKU is required'),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    category_id: z.string().optional(),
    collection_id: z.string().optional(),
    material: z.string().optional(),
    weight: z.string().optional(),
    color: z.string().optional(),
    category: z.string().optional(), // Legacy, sync from category_id
    rental_price: z.coerce.number().min(0, 'Price must be positive'),
    replacement_cost: z.coerce.number().min(0, 'Cost must be positive'),
    status: z.enum(['active', 'maintenance', 'retired']),
})

type ItemFormData = z.infer<typeof itemSchema>

interface Category {
    id: string
    name: string
}

interface Collection {
    id: string
    name: string
}

interface ItemFormProps {
    item?: Item
    mode: 'create' | 'edit'
    categories: Category[]
    collections: Collection[]
    isStaging?: boolean
    onSubmitOverride?: (data: ItemFormData & { image_paths: string[] }) => Promise<{ success: boolean; error?: string }>
    initialData?: Partial<ItemFormData> & { image_paths?: string[] }
    onCancel?: () => void
}

const STATUS_OPTIONS: typeof ITEM_STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'retired', label: 'Retired' },
]

export const ItemForm = ({
    item,
    mode,
    categories: initialCategories,
    collections: initialCollections,
    isStaging = false,
    onSubmitOverride,
    initialData,
    onCancel
}: ItemFormProps) => {
    const router = useRouter()
    const [isSubmitting, startSubmitting] = useTransition()
    const [images, setImages] = useState<string[]>(initialData?.image_paths ?? item?.image_paths ?? [])
    const [specs, setSpecs] = useState<ItemSpecs>(
        (item?.specs as ItemSpecs) ?? {}
    )
    const [uploadingImage, setUploadingImage] = useState(false)
    const [isCloneAfterSave, setIsCloneAfterSave] = useState(false)

    // Workflow state
    const [isAddingVariation, setIsAddingVariation] = useState(false)
    const [lastSavedItemName, setLastSavedItemName] = useState<string | null>(null)

    // Local state for categories/collections to support immediate UI updates after quick add
    const [categories, setCategories] = useState(initialCategories)
    const [collections, setCollections] = useState(initialCollections)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        reset,
    } = useForm<ItemFormData>({
        resolver: zodResolver(itemSchema) as any,
        defaultValues: {
            sku: initialData?.sku ?? item?.sku ?? '',
            name: initialData?.name ?? item?.name ?? '',
            description: initialData?.description ?? item?.description ?? '',
            category_id: initialData?.category_id ?? item?.category_id ?? '',
            collection_id: initialData?.collection_id ?? item?.collection_id ?? '',
            material: initialData?.material ?? item?.material ?? '',
            weight: initialData?.weight ?? item?.weight ?? '',
            color: initialData?.color ?? item?.color ?? '',
            category: initialData?.category ?? item?.category ?? '',
            rental_price: initialData?.rental_price ?? item?.rental_price ?? 0,
            replacement_cost: initialData?.replacement_cost ?? item?.replacement_cost ?? 0,
            status: (initialData?.status as ItemFormData['status']) ?? item?.status ?? 'active',
        },
    })

    // Watch category_id to sync category name
    const selectedCategoryId = watch('category_id')

    // Sync category name when ID changes
    if (selectedCategoryId) {
        const cat = categories.find(c => c.id === selectedCategoryId)
        if (cat && watch('category') !== cat.name) {
            setValue('category', cat.name)
        }
    }

    const handleQuickAddCategory = async () => {
        const name = prompt("Enter new category name:")
        if (!name) return

        const result = await createCategory(name)
        if (result.success && result.data) {
            setCategories([...categories, result.data])
            setValue('category_id', result.data.id)
            toast.success(`Category "${name}" created`)
        } else {
            toast.error("Failed to create category")
        }
    }

    const handleQuickAddCollection = async () => {
        const name = prompt("Enter new collection name:")
        if (!name) return

        const result = await createCollection(name)
        if (result.success && result.data) {
            setCollections([...collections, result.data])
            setValue('collection_id', result.data.id)
            toast.success(`Collection "${name}" created`)
        } else {
            toast.error("Failed to create collection")
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingImage(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const result = await uploadItemImage(formData)
            if (result.success && result.url) {
                setImages([...images, result.url])
                toast.success('Image uploaded')
            } else {
                console.error('Upload failed:', result.error)
                toast.error(result.error || 'Failed to upload image')
            }
        } catch (error) {
            console.error('Upload error:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploadingImage(false)
        }
    }

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index))
    }

    const addSpec = () => {
        const key = prompt('Enter spec name (e.g., size, karat):')
        if (key && key.trim()) {
            setSpecs({ ...specs, [key.trim()]: '' })
        }
    }

    const updateSpec = (key: string, value: string) => {
        setSpecs({ ...specs, [key]: value })
    }

    const removeSpec = (key: string) => {
        const newSpecs = { ...specs }
        delete newSpecs[key]
        setSpecs(newSpecs)
    }

    const onSubmit = async (data: ItemFormData) => {
        startSubmitting(() => {
            void (async () => {
                try {
                    const itemData = {
                        ...data,
                        image_paths: images,
                        specs,
                        description: data.description || undefined,
                        category_id: data.category_id || undefined,
                        collection_id: data.collection_id || undefined,
                        material: data.material || undefined,
                        weight: data.weight || undefined,
                        color: data.color || undefined,
                        // Ensure category string is synced if category_id represents a known category
                        category: data.category || (data.category_id ? categories.find(c => c.id === data.category_id)?.name : undefined)
                    }

                    if (isStaging && onSubmitOverride) {
                        const result = await onSubmitOverride({
                            ...itemData,
                            category_id: data.category_id, // Ensure optional fields are passed
                            collection_id: data.collection_id,
                            image_paths: images
                        })

                        if (result.success) {
                            toast.success("Item updated in staging")
                        } else {
                            toast.error(result.error || "Failed to update item")
                        }
                        return
                    }

                    let result

                    // Determine operation:
                    // 1. Create Mode: Always create
                    // 2. Edit Mode + isAddingVariation (Clone loop): Always create new item
                    // 3. Edit Mode (Initial Save): Update existing
                    const shouldCreateNew = mode === 'create' || isAddingVariation

                    // Special case for "Save & Add Variation" from Edit Mode:
                    // If we are editing (not yet in loop) and click "Save & Add", we usually want to UPDATE the current item first, 
                    // then switch to creating new ones. 
                    // BUT, if the user requested "Clone", previously we forced Create. 
                    // The standard behavior for "Save & Add" on Edit Page is: Save changes to THIS item, then start NEW One.

                    if (shouldCreateNew) {
                        result = await createItem(itemData)
                    } else {
                        // We are in Edit Mode and NOT in the variation loop yet.
                        // Even if isCloneAfterSave is true, we update the current item first.
                        result = await updateItem(item!.id, itemData)
                    }

                    if (result.success) {
                        if (isCloneAfterSave) {
                            // Clone Mode: Prepare form for the next variation

                            // Logic: Keep existing images (user request), but prompt.
                            // Keep everything else.
                            // Reset SKU to avoid conflict.

                            setValue('sku', `${data.sku}-VAR`)
                            setValue('color', '') // Reset Color
                            setImages([]) // User requested to CLEAR images for new color

                            setIsCloneAfterSave(false)
                            setIsAddingVariation(true)
                            setLastSavedItemName(itemData.name)

                            toast.success("Item saved successfully", {
                                description: "Design saved. Now adding a new variation..."
                            })

                            // Scroll to top to show banner
                            window.scrollTo({ top: 0, behavior: 'smooth' })

                        } else {
                            toast.success("Item saved successfully")
                            router.push('/admin/items')
                            router.refresh()
                        }
                    } else {
                        console.error('Save failed:', result.error)
                        toast.error(`Failed to save item: ${result.error}`)
                    }
                } catch (error) {
                    console.error('Submit error:', error)
                    toast.error("An unexpected error occurred")
                }
            })()
        })
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {isAddingVariation && lastSavedItemName && (
                <Alert className="border-green-500 bg-green-50 text-green-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle>Success!</AlertTitle>
                    <AlertDescription>
                        Design &quot;{lastSavedItemName}&quot; saved. Now adding a new variation...
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Basic Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="sku">SKU *</Label>
                            <Input
                                id="sku"
                                {...register('sku')}
                                placeholder="e.g., RING-001"
                            />
                            {errors.sku && (
                                <p className="text-sm text-red-500">{errors.sku.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                {...register('name')}
                                placeholder="e.g., Diamond Solitaire Ring"
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500">{errors.name.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                {...register('description')}
                                placeholder="Describe the item..."
                                rows={3}
                            />
                        </div>

                        {/* Collections & Categories */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category_id">Category</Label>
                                <div className="flex gap-2">
                                    <Select
                                        value={watch('category_id') || "none"}
                                        onValueChange={(value) => setValue('category_id', value === "none" ? "" : value)}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {categories.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" onClick={handleQuickAddCategory} title="Quick Add Category">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="collection_id">Collection</Label>
                                <div className="flex gap-2">
                                    <Select
                                        value={watch('collection_id') || "none"}
                                        onValueChange={(value) => setValue('collection_id', value === "none" ? "" : value)}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Select Collection" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {collections.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" onClick={handleQuickAddCollection} title="Quick Add Collection">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Color, Material & Weight */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="color">Color / Variant</Label>
                                <Input
                                    id="color"
                                    {...register('color')}
                                    placeholder="e.g., Red, Clear"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="material">Material</Label>
                                <Input
                                    id="material"
                                    {...register('material')}
                                    placeholder="e.g., 18K Gold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="weight">Weight</Label>
                                <Input
                                    id="weight"
                                    {...register('weight')}
                                    placeholder="e.g., 3.5g"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={watch('status')}
                                onValueChange={(value) =>
                                    setValue('status', value as ItemFormData['status'])
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Pricing */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pricing</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="rental_price">Rental Price ($) *</Label>
                            <Input
                                id="rental_price"
                                type="number"
                                step="0.01"
                                {...register('rental_price')}
                                placeholder="0.00"
                            />
                            {errors.rental_price && (
                                <p className="text-sm text-red-500">
                                    {errors.rental_price.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="replacement_cost">
                                Replacement Cost ($) *
                            </Label>
                            <Input
                                id="replacement_cost"
                                type="number"
                                step="0.01"
                                {...register('replacement_cost')}
                                placeholder="0.00"
                            />
                            {errors.replacement_cost && (
                                <p className="text-sm text-red-500">
                                    {errors.replacement_cost.message}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Used for deposit/insurance reference
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Images */}
                <Card>
                    <CardHeader>
                        <CardTitle>Images</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            {images.map((url, index) => (
                                <div key={index} className="relative">
                                    <Image
                                        src={url}
                                        alt={`Item image ${index + 1}`}
                                        width={100}
                                        height={100}
                                        className="h-24 w-24 rounded-lg object-cover"
                                        unoptimized
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(index)}
                                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {/* Only allow uploads if not in staging mode (or implement staging uploads later) */}
                            {/* Staging usually has external URLs, but we could allow uploads if needed. keeping enabled for now. */}
                            <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    disabled={uploadingImage}
                                />
                                {uploadingImage ? (
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                                ) : (
                                    <Upload className="h-6 w-6 text-slate-400" />
                                )}
                            </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Upload images to Supabase Storage
                        </p>
                    </CardContent>
                </Card>

                {/* Specs - Hidden in Staging Mode as staging_items tokens usually don't support custom specs yet */}
                {!isStaging && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Specifications</CardTitle>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addSpec}
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                Add Spec
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Object.entries(specs).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <Label className="w-24 shrink-0 text-sm capitalize">
                                        {key}
                                    </Label>
                                    <Input
                                        value={value ?? ''}
                                        onChange={(e) => updateSpec(key, e.target.value)}
                                        placeholder={`Enter ${key}...`}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeSpec(key)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {Object.keys(specs).length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No specifications added yet. Click &quot;Add Spec&quot; to add size, carat, etc.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
                <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => {
                        if (onCancel) {
                            onCancel()
                            return
                        }

                        if (isAddingVariation) {
                            // Confirm before leaving if variants were added
                            if (confirm("Your previously saved variants are safe. Do you want to stop adding more?")) {
                                router.push('/admin/items')
                            }
                        } else {
                            if (isStaging && onSubmitOverride) {
                                // Close dialog if in staging mode (handled by parent usually, but this button is type=button, parent needs to handle close)
                                // Actually, cancel button in StagingItemsList calls onClose. 
                                // But here we are inside ItemForm. 
                                // We might need an onCancel prop.
                                // iterating: StagingItemsList renders this in a Dialog. 
                                // The Cancel button here just calls router.push which is BAD for a Dialog.
                                // We should accept an onCancel prop.
                            } else {
                                router.push('/admin/items')
                            }
                        }
                    }}
                >
                    Cancel
                </Button>

                {/* Save and Add Variation Button - Hidden in Staging */}
                {!isStaging && (
                    <Button
                        type="submit"
                        variant="secondary"
                        disabled={isSubmitting}
                        onClick={() => setIsCloneAfterSave(true)}
                        className="gap-2"
                        title="Save current item and clone it as a new variation"
                    >
                        {isSubmitting && isCloneAfterSave ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {isSubmitting && isCloneAfterSave ? 'Processing...' : (isAddingVariation ? 'Save & Add Another Color' : 'Save & Add Variation')}
                    </Button>
                )}

                <Button type="submit" disabled={isSubmitting} onClick={() => setIsCloneAfterSave(false)}>
                    {isSubmitting && !isCloneAfterSave && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting && !isCloneAfterSave
                        ? 'Processing...'
                        : isStaging
                            ? 'Save Changes'
                            : (isAddingVariation || mode === 'create')
                                ? (isAddingVariation ? 'Save & Finish' : 'Create Product')
                                : 'Update Item'}
                </Button>
            </div>
        </form>
    )
}
