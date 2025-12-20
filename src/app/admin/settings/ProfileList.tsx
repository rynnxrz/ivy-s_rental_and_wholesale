'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { createBillingProfile, updateBillingProfile, deleteBillingProfile, setDefaultProfile } from '@/app/admin/actions'
import { Loader2, Star, Pencil, Trash2, Plus } from 'lucide-react'
import type { BillingProfile } from '@/types/database.types'

interface ProfileListProps {
    profiles: BillingProfile[]
}

export default function ProfileList({ profiles }: ProfileListProps) {
    const [editingProfile, setEditingProfile] = useState<BillingProfile | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const handleSetDefault = async (profileId: string) => {
        setLoading(true)
        setMessage(null)
        const result = await setDefaultProfile(profileId)
        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: 'Default profile updated!' })
        }
        setLoading(false)
    }

    const handleDelete = async (profileId: string) => {
        if (!confirm('Are you sure you want to delete this billing profile?')) return

        setLoading(true)
        setMessage(null)
        const result = await deleteBillingProfile(profileId)
        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: 'Profile deleted!' })
        }
        setLoading(false)
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Billing Profiles</CardTitle>
                        <CardDescription>
                            Create multiple billing identities for different payment methods or regions.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsCreating(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Profile
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {message && (
                    <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message.text}
                    </div>
                )}

                {profiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No billing profiles yet. Create one to get started.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {profiles.map((profile) => (
                            <div
                                key={profile.id}
                                className={`border rounded-lg p-4 ${profile.is_default ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-gray-900">{profile.profile_name}</h3>
                                            {profile.is_default && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    <Star className="h-3 w-3" />
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">{profile.company_header}</p>
                                        <p className="text-xs text-gray-400 mt-1">{profile.contact_email}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!profile.is_default && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSetDefault(profile.id)}
                                                disabled={loading}
                                                title="Set as default"
                                            >
                                                <Star className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingProfile(profile)}
                                            disabled={loading}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        {!profile.is_default && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(profile.id)}
                                                disabled={loading}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Edit Dialog */}
                <ProfileEditor
                    profile={editingProfile}
                    open={editingProfile !== null}
                    onClose={() => setEditingProfile(null)}
                    mode="edit"
                />

                {/* Create Dialog */}
                <ProfileEditor
                    profile={null}
                    open={isCreating}
                    onClose={() => setIsCreating(false)}
                    mode="create"
                    isFirstProfile={profiles.length === 0}
                />
            </CardContent>
        </Card>
    )
}

interface ProfileEditorProps {
    profile: BillingProfile | null
    open: boolean
    onClose: () => void
    mode: 'create' | 'edit'
    isFirstProfile?: boolean
}

function ProfileEditor({ profile, open, onClose, mode, isFirstProfile = false }: ProfileEditorProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)

        let result
        if (mode === 'edit' && profile) {
            result = await updateBillingProfile(profile.id, formData)
        } else {
            // If first profile, set as default automatically
            if (isFirstProfile) {
                formData.set('is_default', 'true')
            }
            result = await createBillingProfile(formData)
        }

        if (result.error) {
            setError(result.error)
            setLoading(false)
        } else {
            setLoading(false)
            onClose()
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Create Billing Profile' : 'Edit Billing Profile'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Add a new billing identity with company and payment details.'
                            : 'Update the billing profile details.'}
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 rounded text-sm bg-red-100 text-red-800">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="profile_name">Profile Name</Label>
                        <Input
                            id="profile_name"
                            name="profile_name"
                            defaultValue={profile?.profile_name || ''}
                            placeholder="e.g., US Rental (Chase Bank)"
                            required
                        />
                        <p className="text-xs text-gray-500">
                            A short identifier for this billing option.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="company_header">Company Header</Label>
                        <Textarea
                            id="company_header"
                            name="company_header"
                            defaultValue={profile?.company_header || ''}
                            placeholder="Company Name&#10;123 Main St, City, State&#10;Tax ID: XXX"
                            rows={3}
                            required
                        />
                        <p className="text-xs text-gray-500">
                            Company name and address that will appear on invoices.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bank_info">Bank / Payment Info</Label>
                        <Textarea
                            id="bank_info"
                            name="bank_info"
                            defaultValue={profile?.bank_info || ''}
                            placeholder="Bank: Chase Bank&#10;Account Name: Ivy's Rental&#10;Account Number: 1234567890"
                            rows={4}
                            required
                        />
                        <p className="text-xs text-gray-500">
                            Payment instructions shown in the invoice.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="contact_email">Contact Email</Label>
                        <Input
                            id="contact_email"
                            name="contact_email"
                            type="email"
                            defaultValue={profile?.contact_email || ''}
                            placeholder="billing@example.com"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {mode === 'create' ? 'Create Profile' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
