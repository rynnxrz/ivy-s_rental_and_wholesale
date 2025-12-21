"use client"

import * as React from "react"
import { useRequestStore } from "@/store/request"
import { format, differenceInDays, parse } from "date-fns"
import { ShoppingBag, Trash2, Calendar, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
    SheetFooter,
} from "@/components/ui/sheet"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function RequestFloatingButton() {
    const { items, dateRange, removeItem } = useRequestStore()
    const [open, setOpen] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    // Calculate details
    const hasDates = dateRange.from && dateRange.to
    const fromDate = hasDates ? parse(dateRange.from!, 'yyyy-MM-dd', new Date()) : null
    const toDate = hasDates ? parse(dateRange.to!, 'yyyy-MM-dd', new Date()) : null

    const days = (fromDate && toDate)
        ? Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0

    const totalCost = items.reduce((sum, item) => sum + (item.rental_price * days), 0)

    const getImageUrl = (images: string[] | null) => {
        if (images && images.length > 0) return images[0]
        return 'https://placehold.co/100x100?text=No+Img'
    }

    // Bounce animation on item add
    const [isBouncing, setIsBouncing] = React.useState(false)
    const prevCountRef = React.useRef(items.length)

    React.useEffect(() => {
        if (items.length > prevCountRef.current) {
            setIsBouncing(true)
            const timer = setTimeout(() => setIsBouncing(false), 300)
            return () => clearTimeout(timer)
        }
        prevCountRef.current = items.length
    }, [items.length])

    if (!isMounted || items.length === 0) return null

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "relative h-10 w-10 text-slate-900 hover:bg-slate-100 rounded-full transition-transform",
                        isBouncing && "scale-125"
                    )}
                >
                    <ShoppingBag className="h-5 w-5" />
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white ring-0 animate-in fade-in zoom-in" />
                </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col w-full sm:max-w-lg">
                <SheetHeader className="border-b pb-4">
                    <SheetTitle>Your Request List</SheetTitle>
                    <SheetDescription>
                        Key items you've selected for your rental inquiry.
                    </SheetDescription>
                </SheetHeader>

                {/* Date Summary */}
                <div className="py-4 border-b">
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-md">
                        <Calendar className="h-5 w-5 text-gray-500" />
                        <div>
                            <p className="text-sm font-medium text-gray-900">
                                {hasDates ? (
                                    <>
                                        {format(fromDate!, 'MMM d, yyyy')} - {format(toDate!, 'MMM d, yyyy')}
                                    </>
                                ) : (
                                    <span className="text-red-500">Dates not selected</span>
                                )}
                            </p>
                            {hasDates && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Duration: {days} day{days !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
                    {items.map((item) => (
                        <div key={item.id} className="flex gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors group relative">
                            <div className="relative h-20 w-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                                <Image
                                    src={getImageUrl(item.image_paths)}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-medium text-sm text-gray-900 truncate pr-6">{item.name}</h4>
                                    <p className="text-xs text-gray-500 capitalize">{item.category}</p>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-sm font-medium text-gray-900">
                                        ${item.rental_price} <span className="text-xs text-gray-500 font-normal">/ day</span>
                                    </p>
                                    {hasDates && (
                                        <p className="text-xs text-gray-500">
                                            Total: <span className="font-medium text-gray-900">${(item.rental_price * days).toFixed(2)}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.id)}
                                className="absolute top-2 right-2 h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50"
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="mt-auto border-t pt-4 space-y-4">
                    <div className="flex items-center justify-between text-base font-medium">
                        <span>Estimated Total</span>
                        <span>${totalCost.toFixed(2)}</span>
                    </div>

                    <SheetFooter>
                        <Link href="/request/summary" className="w-full" onClick={() => setOpen(false)}>
                            <Button className="w-full h-12 text-base gap-2" disabled={items.length === 0}>
                                Confirm Request
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </SheetFooter>
                </div>
            </SheetContent>
        </Sheet>
    )
}
