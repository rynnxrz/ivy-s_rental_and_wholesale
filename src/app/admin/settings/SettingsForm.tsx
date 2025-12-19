'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateSettings } from '@/app/admin/actions'
import { Loader2 } from 'lucide-react'
// import { toast } from 'sonner'

// If toast is not available, we can just use alert or a local state message.
// I'll stick to a simple alert if toast isn't obvious, but likely they have one.
// Looking at previous code, I didn't see explicit toast usage. I'll use simple state feedback.

interface SettingsFormProps {
    initialSettings: {
        company_name: string
        bank_account_info: string
        invoice_footer_text: string
        contact_email: string
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
                    <CardTitle>Invoice & Company Settings</CardTitle>
                    <CardDescription>
                        These details will appear on all generated PDF invoices.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

                    {message && (
                        <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="company_name">Company Name</Label>
                        <Input
                            id="company_name"
                            name="company_name"
                            defaultValue={initialSettings.company_name}
                            placeholder="Ivy's Rental"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="contact_email">Contact Email</Label>
                        <Input
                            id="contact_email"
                            name="contact_email"
                            type="email"
                            defaultValue={initialSettings.contact_email}
                            placeholder="contact@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bank_account_info">Bank Account Info</Label>
                        <Textarea
                            id="bank_account_info"
                            name="bank_account_info"
                            defaultValue={initialSettings.bank_account_info}
                            placeholder="Bank Name, Account Number, Routing Number, etc."
                            rows={4}
                            required
                        />
                        <p className="text-xs text-gray-500">
                            Use newlines to format the bank block nicely on the invoice.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="invoice_footer_text">Invoice Footer Text</Label>
                        <Textarea
                            id="invoice_footer_text"
                            name="invoice_footer_text"
                            defaultValue={initialSettings.invoice_footer_text}
                            placeholder="Thank you for your business! Terms & Conditions..."
                            rows={2}
                        />
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
