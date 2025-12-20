'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
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
import { Upload, X, Plus } from 'lucide-react'
import { createItem, updateItem, uploadItemImage } from '@/actions/items'
import type { Item, ItemSpecs, ITEM_STATUS_OPTIONS } from '@/types'

const itemSchema = z.object({
    sku: z.string().min(1, 'SKU is required'),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    category: z.string().optional(),
    rental_price: z.preprocess(
        (val) => (val === '' ? 0 : Number(val)),
        z.number().min(0, 'Price must be positive')
    ),
    replacement_cost: z.preprocess(
        (val) => (val === '' ? 0 : Number(val)),
        z.number().min(0, 'Cost must be positive')
    ),
    status: z.enum(['active', 'maintenance', 'retired']),
})

type ItemFormData = z.infer<typeof itemSchema>

interface ItemFormProps {
    item?: Item
    mode: 'create' | 'edit'
}

const STATUS_OPTIONS: typeof ITEM_STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'retired', label: 'Retired' },
]

export const ItemForm = ({ item, mode }: ItemFormProps) => {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [images, setImages] = useState<string[]>(item?.image_paths ?? [])
    const [specs, setSpecs] = useState<ItemSpecs>(
        (item?.specs as ItemSpecs) ?? {}
    )
    const [uploadingImage, setUploadingImage] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } = useForm<ItemFormData>({
        resolver: zodResolver(itemSchema) as any,
        defaultValues: {
            sku: item?.sku ?? '',
            name: item?.name ?? '',
            description: item?.description ?? '',
            category: item?.category ?? '',
            rental_price: item?.rental_price ?? 0,
            replacement_cost: item?.replacement_cost ?? 0,
            status: item?.status ?? 'active',
        },
    })

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
            } else {
                console.error('Upload failed:', result.error)
            }
        } catch (error) {
            console.error('Upload error:', error)
        } finally {
            setUploadingImage(false)
        }
    }

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index))
    }

    const addSpec = () => {
        const key = prompt('Enter spec name (e.g., size, material):')
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
        setIsSubmitting(true)
        try {
            const itemData = {
                ...data,
                image_paths: images,
                specs,
                description: data.description || null,
                category: data.category || null,
            }

            let result
            if (mode === 'create') {
                result = await createItem(itemData)
            } else {
                result = await updateItem(item!.id, itemData)
            }

            if (result.success) {
                router.push('/admin/items')
            } else {
                console.error('Save failed:', result.error)
                alert('Failed to save item: ' + result.error)
            }
        } catch (error) {
            console.error('Submit error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Input
                                id="category"
                                {...register('category')}
                                placeholder="e.g., ring, necklace, bracelet"
                            />
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

                {/* Specs */}
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
                                No specifications added yet. Click &quot;Add Spec&quot; to add size, material, etc.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/admin/items')}
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                        ? 'Saving...'
                        : mode === 'create'
                            ? 'Create Item'
                            : 'Update Item'}
                </Button>
            </div>
        </form>
    )
}
