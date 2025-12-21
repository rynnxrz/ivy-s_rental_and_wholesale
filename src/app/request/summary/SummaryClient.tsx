"use client"

import * as React from "react"
import { useRequestStore } from "@/store/request"
import { useRouter } from "next/navigation"
import { format, parse } from "date-fns"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { COUNTRIES } from "@/lib/constants/countries"
import { Loader2, ArrowLeft, Calendar } from "lucide-react"
import { submitBulkRequest } from "@/actions/bulkRequest"
import { toast } from "sonner"

export function SummaryClient() {
    const { items, dateRange, clearRequest } = useRequestStore()
    const router = useRouter()
    const [isMounted, setIsMounted] = React.useState(false) // Hydration fix
    const [isSubmitting, startSubmitTransition] = React.useTransition()

    // Form state
    const [email, setEmail] = React.useState('')
    const [fullName, setFullName] = React.useState('')
    const [companyName, setCompanyName] = React.useState('')
    const [notes, setNotes] = React.useState('')
    const [accessPassword, setAccessPassword] = React.useState('')

    // Address State
    const [country, setCountry] = React.useState('')
    const [cityRegion, setCityRegion] = React.useState('')
    const [addressLine1, setAddressLine1] = React.useState('')
    const [addressLine2, setAddressLine2] = React.useState('')
    const [postcode, setPostcode] = React.useState('')
    const [openCountry, setOpenCountry] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    // Redirect if empty (only after mount logic)
    React.useEffect(() => {
        if (isMounted && items.length === 0) {
            router.replace('/catalog')
        }
    }, [isMounted, items, router])

    if (!isMounted) return null // Or skeleton

    const hasDates = dateRange.from && dateRange.to
    const fromDate = hasDates ? parse(dateRange.from!, 'yyyy-MM-dd', new Date()) : null
    const toDate = hasDates ? parse(dateRange.to!, 'yyyy-MM-dd', new Date()) : null

    const days = (fromDate && toDate)
        ? Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0

    const totalEstimate = items.reduce((sum, item) => sum + (item.rental_price * days), 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hasDates) {
            toast.error("Dates are missing. Please restart your request.")
            return
        }

        if (!country || !cityRegion || !addressLine1 || !postcode) {
            toast.error("Please fill in all required location and address fields.")
            return
        }

        startSubmitTransition(() => {
            void (async () => {
                try {
                    const result = await submitBulkRequest({
                        items: items.map(i => i.id),
                        email,
                        full_name: fullName,
                        company_name: companyName,
                        notes,
                        start_date: dateRange.from!,
                        end_date: dateRange.to!,
                        access_password: accessPassword,
                        country,
                        city_region: cityRegion,
                        address_line1: addressLine1,
                        address_line2: addressLine2,
                        postcode
                    })

                    if (result.error) {
                        toast.error(result.error)
                    } else {
                        toast.success('Request submitted successfully')
                        clearRequest()
                        router.push('/request/success')
                    }
                } catch (err) {
                    console.error('Submission error:', err)
                    toast.error('An unexpected error occurred.')
                }
            })()
        })
    }

    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/100x100?text=No+Img'
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <Button
                    variant="ghost"
                    className="mb-8 pl-0 hover:bg-transparent hover:text-gray-900 text-gray-500"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* Left Column: Summary */}
                    <div className="lg:col-span-7 space-y-8">
                        <div>
                            <h1 className="text-3xl font-light text-gray-900 mb-2">Review Request</h1>
                            <p className="text-gray-500">Please review your selected items and dates before submitting.</p>
                        </div>

                        {/* Date Card */}
                        <div className="bg-white p-6 rounded-sm shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="h-12 w-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                                <Calendar className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Requested Dates</p>
                                {hasDates ? (
                                    <p className="text-lg text-gray-900">
                                        {format(fromDate!, 'MMM d, yyyy')} - {format(toDate!, 'MMM d, yyyy')}
                                        <span className="text-gray-400 ml-2 text-base">({days} days)</span>
                                    </p>
                                ) : (
                                    <p className="text-red-500">Dates not selected</p>
                                )}
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-medium text-gray-900">Selected Items ({items.length})</h2>
                            <div className="bg-white rounded-sm shadow-sm border border-gray-100 divide-y divide-gray-100">
                                {items.map((item) => (
                                    <div key={item.id} className="p-4 flex gap-4">
                                        <div className="relative h-24 w-24 bg-gray-100 rounded-sm overflow-hidden flex-shrink-0">
                                            <Image
                                                src={getImageUrl(item.image_paths)}
                                                alt={item.name}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                            <div>
                                                <h3 className="font-medium text-gray-900">{item.name}</h3>
                                                <p className="text-sm text-gray-500 capitalize">{item.category}</p>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <p className="text-sm text-gray-500">
                                                    ${item.rental_price} / day
                                                </p>
                                                <p className="font-medium text-gray-900">
                                                    ${(item.rental_price * days).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="p-4 bg-gray-50 flex justify-between items-center text-lg font-medium">
                                    <span>Estimated Total</span>
                                    <span>${totalEstimate.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Form */}
                    <div className="lg:col-span-5">
                        <div className="bg-white p-8 rounded-sm shadow-sm border border-gray-100 sticky top-8">
                            <h2 className="text-xl font-light text-gray-900 mb-6">Contact Information</h2>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <Input
                                        id="fullName"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        required
                                        placeholder="Jane Doe"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        placeholder="jane@company.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company">Company (Optional)</Label>
                                    <Input
                                        id="company"
                                        value={companyName}
                                        onChange={e => setCompanyName(e.target.value)}
                                        placeholder="Company Ltd."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="pt-6 border-t border-gray-100">
                                        <h3 className="text-lg font-light text-gray-900 mb-4">Address Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 space-y-0">
                                            <div className="space-y-2">
                                                <Label>Country/Region</Label>
                                                <Popover open={openCountry} onOpenChange={setOpenCountry}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={openCountry}
                                                            className="w-full justify-between font-normal text-left h-10 px-3 py-2 border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {country
                                                                ? COUNTRIES.find((c) => c === country)
                                                                : "Select country..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search country..." />
                                                            <CommandList>
                                                                <CommandEmpty>No country found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {COUNTRIES.map((c) => (
                                                                        <CommandItem
                                                                            key={c}
                                                                            value={c}
                                                                            onSelect={(currentValue: string) => {
                                                                                setCountry(currentValue === country ? "" : currentValue)
                                                                                setOpenCountry(false)
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    country === c ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            {c}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="cityRegion">City / Town</Label>
                                                <Input
                                                    id="cityRegion"
                                                    value={cityRegion}
                                                    onChange={e => setCityRegion(e.target.value)}
                                                    required
                                                    placeholder="City"
                                                />
                                            </div>
                                            <div className="md:col-span-2 space-y-2">
                                                <Label htmlFor="addressLine1">Street Address</Label>
                                                <Input
                                                    id="addressLine1"
                                                    value={addressLine1}
                                                    onChange={e => setAddressLine1(e.target.value)}
                                                    required
                                                    placeholder="Street address, P.O. box, company name, c/o"
                                                />
                                            </div>
                                            <div className="md:col-span-2 space-y-2">
                                                <Label htmlFor="addressLine2">Apt, Suite, etc. (Optional)</Label>
                                                <Input
                                                    id="addressLine2"
                                                    value={addressLine2}
                                                    onChange={e => setAddressLine2(e.target.value)}
                                                    placeholder="Apartment, suite, unit, building, floor, etc."
                                                />
                                            </div>
                                            <div className="md:col-span-1 space-y-2">
                                                <Label htmlFor="postcode">Postcode / ZIP</Label>
                                                <Input
                                                    id="postcode"
                                                    value={postcode}
                                                    onChange={e => setPostcode(e.target.value)}
                                                    required
                                                    placeholder="ZIP code"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-6">
                                        <Label htmlFor="notes">Notes (Optional)</Label>
                                        <Textarea
                                            id="notes"
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="Any special requests or instructions..."
                                            className="resize-none h-24"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <div className="space-y-2">
                                        <Label htmlFor="accessPassword">Access Password</Label>
                                        <Input
                                            id="accessPassword"
                                            type="password"
                                            value={accessPassword}
                                            onChange={e => setAccessPassword(e.target.value)}
                                            placeholder="Enter if required"
                                        />
                                        <p className="text-xs text-gray-500">
                                            If you have been provided with an access code, please enter it here.
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-14 text-base uppercase tracking-widest mt-6"
                                    disabled={isSubmitting || items.length === 0}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit Request'
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
