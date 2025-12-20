'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { updateSettings } from '@/app/admin/actions'
import { Loader2, Mail, Eye, Sparkles, User, Gem, Calendar, DollarSign } from 'lucide-react'

interface SettingsFormProps {
    initialSettings: {
        turnaround_buffer: number
        contact_email: string | null
        booking_password: string | null
        email_approval_body: string | null
        email_footer: string | null
    }
}

// Sample data for preview
const PREVIEW_DATA = {
    customerName: 'Jane Doe',
    itemName: 'Signature Diamond Ring',
    startDate: 'Dec 25, 2024',
    endDate: 'Dec 31, 2024',
    totalAmount: '$1,250.00',
    reservationId: 'INV-2024-001',
    totalDays: 7,
}

// Variable buttons configuration
const VARIABLE_BUTTONS = [
    { label: 'Customer Name', placeholder: '{{customerName}}', icon: User },
    { label: 'Item Name', placeholder: '{{itemName}}', icon: Gem },
    { label: 'Start Date', placeholder: '{{startDate}}', icon: Calendar },
    { label: 'End Date', placeholder: '{{endDate}}', icon: Calendar },
    { label: 'Total Amount', placeholder: '{{totalAmount}}', icon: DollarSign },
]

// Replace placeholders with preview data
function replaceWithPreviewData(template: string): string {
    if (!template) return ''
    return template
        .replace(/\{\{customerName\}\}/g, PREVIEW_DATA.customerName)
        .replace(/\{\{itemName\}\}/g, PREVIEW_DATA.itemName)
        .replace(/\{\{startDate\}\}/g, PREVIEW_DATA.startDate)
        .replace(/\{\{endDate\}\}/g, PREVIEW_DATA.endDate)
        .replace(/\{\{totalAmount\}\}/g, PREVIEW_DATA.totalAmount)
        .replace(/\{\{reservationId\}\}/g, PREVIEW_DATA.reservationId)
}

// Default email templates
const DEFAULT_BODY = `Dear {{customerName}},

Great news! Your reservation for {{itemName}} has been approved.

Please find the attached invoice for your records. Payment instructions are included in the invoice.`

const DEFAULT_FOOTER = `Best regards,
Ivy's Rental & Wholesale
Contact us for any questions`

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Controlled state for live preview
    const [emailBody, setEmailBody] = useState(initialSettings.email_approval_body || '')
    const [emailFooter, setEmailFooter] = useState(initialSettings.email_footer || '')

    const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setMessage(null)

        const result = await updateSettings(formData)

        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else {
            setMessage({ type: 'success', text: 'Settings saved successfully!' })
        }
        setLoading(false)
    }

    // Insert variable at cursor position
    function insertVariable(placeholder: string) {
        const textarea = bodyTextareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = emailBody.slice(0, start) + placeholder + emailBody.slice(end)

        setEmailBody(newValue)

        // Restore focus and cursor position after React re-render
        setTimeout(() => {
            textarea.focus()
            const newCursorPos = start + placeholder.length
            textarea.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
    }

    // Get preview content (use default if empty)
    const previewBody = emailBody.trim() || DEFAULT_BODY
    const previewFooter = emailFooter.trim() || DEFAULT_FOOTER

    return (
        <form action={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left Column: Editor */}
                <div className="space-y-6">

                    {/* System Settings Card */}
                    <Card className="border-gray-200 shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-light flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-gray-500" />
                                System Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {message && (
                                <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-zinc-50 text-zinc-900 border border-zinc-200' : 'bg-red-50 text-red-900 border border-red-200'}`}>
                                    {message.text}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="turnaround_buffer" className="font-normal text-gray-600">Turnaround Buffer</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="turnaround_buffer"
                                            name="turnaround_buffer"
                                            type="number"
                                            min="0"
                                            defaultValue={initialSettings.turnaround_buffer}
                                            className="w-20"
                                            required
                                        />
                                        <span className="text-sm text-gray-400">days</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="booking_password" className="font-normal text-gray-600">Booking Password</Label>
                                    <Input
                                        id="booking_password"
                                        name="booking_password"
                                        type="text"
                                        defaultValue={initialSettings.booking_password ?? ''}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Email Branding Card */}
                    <Card className="border-gray-200 shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-light flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-gray-500" />
                                    Email Configuration
                                </CardTitle>
                            </div>
                            <CardDescription>
                                Customize the automated approval email sent to clients.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">

                            {/* Reply-to Email */}
                            <div className="space-y-2">
                                <Label htmlFor="contact_email" className="flex items-center gap-2 font-normal text-gray-600">
                                    Reply-to Address
                                </Label>
                                <Input
                                    id="contact_email"
                                    name="contact_email"
                                    type="email"
                                    defaultValue={initialSettings.contact_email ?? ''}
                                    placeholder="ivy@example.com"
                                />
                            </div>

                            {/* Variable Toolbar */}
                            <div className="space-y-2">
                                <Label className="font-normal text-gray-600">Insert Variables</Label>
                                <div className="flex flex-wrap gap-2">
                                    {VARIABLE_BUTTONS.map((btn) => (
                                        <Button
                                            key={btn.placeholder}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50"
                                            onClick={() => insertVariable(btn.placeholder)}
                                        >
                                            <btn.icon className="h-3 w-3" />
                                            {btn.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Email Body */}
                            <div className="space-y-2">
                                <Label htmlFor="email_approval_body" className="font-normal text-gray-600">Email Message</Label>
                                <Textarea
                                    ref={bodyTextareaRef}
                                    id="email_approval_body"
                                    name="email_approval_body"
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder={DEFAULT_BODY}
                                    rows={8}
                                    className="font-mono text-sm resize-none bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                                />
                            </div>

                            {/* Email Footer */}
                            <div className="space-y-2">
                                <Label htmlFor="email_footer" className="font-normal text-gray-600">Signature / Footer</Label>
                                <Textarea
                                    id="email_footer"
                                    name="email_footer"
                                    value={emailFooter}
                                    onChange={(e) => setEmailFooter(e.target.value)}
                                    placeholder={DEFAULT_FOOTER}
                                    rows={4}
                                    className="font-mono text-sm resize-none bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                                />
                            </div>

                            <div className="pt-2">
                                <Button type="submit" disabled={loading} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-normal">
                                    {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                    Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Live Preview */}
                <div className="lg:sticky lg:top-4 h-fit">
                    <Card className="border-0 shadow-none bg-transparent">
                        <CardHeader className="px-0 pt-0 pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-light flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-gray-500" />
                                    Live Preview
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Email Preview Container */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden max-w-md mx-auto">
                                {/* Email Header */}
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white font-serif italic text-sm">
                                        I
                                    </div>
                                    <div className="text-sm font-medium text-gray-900">Ivy's Rental</div>
                                </div>

                                {/* Email Body */}
                                <div className="px-6 py-6 space-y-6 text-sm text-gray-600 leading-relaxed font-sans">
                                    <div className="whitespace-pre-wrap">
                                        {replaceWithPreviewData(previewBody)}
                                    </div>

                                    {/* Reservation Details Box - Minimalist */}
                                    <div className="bg-gray-50 rounded p-4 border border-gray-100">
                                        <div className="space-y-2 text-xs text-gray-500">
                                            <div className="flex justify-between border-b border-gray-200 pb-2">
                                                <span>Item</span>
                                                <span className="font-medium text-gray-900">{PREVIEW_DATA.itemName}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-gray-200 pb-2">
                                                <span>Dates</span>
                                                <span className="font-medium text-gray-900">{PREVIEW_DATA.startDate} - {PREVIEW_DATA.endDate}</span>
                                            </div>
                                            <div className="flex justify-between pt-1">
                                                <span>Total Amount</span>
                                                <span className="font-medium text-gray-900">{PREVIEW_DATA.totalAmount}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-xs text-gray-400 italic border-l-2 border-gray-200 pl-3">
                                        * An invoice PDF will be attached to this email.
                                    </div>
                                </div>

                                {/* Email Footer */}
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                                    <div className="whitespace-pre-wrap text-xs text-gray-500">
                                        {replaceWithPreviewData(previewFooter)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}
