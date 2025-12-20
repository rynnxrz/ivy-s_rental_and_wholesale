'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateSettings } from '@/app/admin/actions'
import { Loader2 } from 'lucide-react'

interface SettingsFormProps {
    initialSettings: {
        turnaround_buffer: number
    }
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setMessage(null)

        const result = await updateSettings(formData)

        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: 'Settings updated successfully!' })
        }
        setLoading(false)
    }

    return (
        <form action={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>System Settings</CardTitle>
                    <CardDescription>
                        Configure system-wide settings for availability calculations.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

                    {message && (
                        <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="turnaround_buffer">Turnaround Buffer (Days)</Label>
                        <Input
                            id="turnaround_buffer"
                            name="turnaround_buffer"
                            type="number"
                            min="0"
                            defaultValue={initialSettings.turnaround_buffer}
                            placeholder="1"
                            required
                            className="max-w-xs"
                        />
                        <p className="text-xs text-gray-500">
                            Days to block after a reservation for cleaning/restocking.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </form>
    )
}
