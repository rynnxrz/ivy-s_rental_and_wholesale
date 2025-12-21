'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateSettings } from '@/app/admin/actions'
import { Loader2, Settings } from 'lucide-react'
import { toast } from 'sonner'

interface SettingsFormProps {
    initialSettings: {
        turnaround_buffer: number
        contact_email: string | null
        booking_password: string | null
    }
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
    async function handleSubmit(formData: FormData) {
        const result = await updateSettings(formData)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Settings saved successfully')
        }
    }

    return (
        <form action={handleSubmit}>
            <Card className="border-gray-200 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-light flex items-center gap-2">
                        <Settings className="h-4 w-4 text-gray-500" />
                        System Configuration
                    </CardTitle>
                    <CardDescription>
                        Core system settings that affect booking availability and access control.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Turnaround Buffer */}
                        <div className="space-y-2">
                            <Label htmlFor="turnaround_buffer" className="font-normal text-gray-600">
                                Turnaround Buffer
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="turnaround_buffer"
                                    name="turnaround_buffer"
                                    type="number"
                                    min="0"
                                    defaultValue={initialSettings.turnaround_buffer}
                                    className="w-24 bg-gray-50 border-gray-200 focus:bg-white"
                                    required
                                />
                                <span className="text-sm text-gray-400">days</span>
                            </div>
                            <p className="text-xs text-gray-400">
                                Minimum gap between reservations for the same item.
                            </p>
                        </div>

                        {/* Booking Password */}
                        <div className="space-y-2">
                            <Label htmlFor="booking_password" className="font-normal text-gray-600">
                                Booking Password
                            </Label>
                            <Input
                                id="booking_password"
                                name="booking_password"
                                type="text"
                                defaultValue={initialSettings.booking_password ?? ''}
                                placeholder="Leave empty for open access"
                                className="bg-gray-50 border-gray-200 focus:bg-white"
                            />
                            <p className="text-xs text-gray-400">
                                Required password for customers to access booking form.
                            </p>
                        </div>

                        {/* Contact Email */}
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="contact_email" className="font-normal text-gray-600">
                                Reply-To Email Address
                            </Label>
                            <Input
                                id="contact_email"
                                name="contact_email"
                                type="email"
                                defaultValue={initialSettings.contact_email ?? ''}
                                placeholder="ivy@example.com"
                                className="bg-gray-50 border-gray-200 focus:bg-white max-w-md"
                            />
                            <p className="text-xs text-gray-400">
                                Replies to automated emails will be sent to this address.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <SaveButton />
                    </div>
                </CardContent>
            </Card>
        </form>
    )
}

function SaveButton() {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            disabled={pending}
            className="bg-gray-900 hover:bg-gray-800 text-white font-normal"
        >
            {pending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Save Changes
        </Button>
    )
}
