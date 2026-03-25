"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
    TieredPricingDisplay,
    formatTierAmount,
    WEEKLY_EXTENSION_NOTICE,
    TIER_AMOUNT_UNAVAILABLE_MESSAGE,
    TIERED_PRICING_TITLE
} from "@/lib/invoice/tiered-display"

interface PricingDisplayProps {
    tieredPricing: TieredPricingDisplay
    hasDates?: boolean
    className?: string
    size?: 'sm' | 'md'
}

export function PricingDisplay({ 
    tieredPricing, 
    hasDates = false, 
    className,
    size = 'sm' 
}: PricingDisplayProps) {
    const isSm = size === 'sm'

    return (
        <div className={cn("flex flex-col space-y-1", className)}>
            <p className={cn(
                "font-semibold uppercase tracking-widest text-slate-500",
                isSm ? "text-[10px]" : "text-xs"
            )}>
                {TIERED_PRICING_TITLE}
            </p>
            
            <div className={cn(
                "flex flex-wrap items-baseline gap-x-1.5 pb-0.5",
                isSm ? "text-xs" : "text-sm leading-tight"
            )}>
                <span className="text-slate-600">1 Week</span>
                <span className="font-semibold text-slate-900">{formatTierAmount(tieredPricing.week1Amount, 15)}</span>
                <span className="text-slate-300 mx-0.5">·</span>
                <span className="text-slate-600">2 Weeks</span>
                <span className="font-semibold text-slate-900">{formatTierAmount(tieredPricing.week2Amount, 20)}</span>
                <span className="text-slate-300 mx-0.5">·</span>
                <span className="text-slate-600">1 Month</span>
                <span className="font-semibold text-slate-900">{formatTierAmount(tieredPricing.monthAmount, 25)}</span>
            </div>

            <p className={cn(
                "text-slate-500",
                isSm ? "text-[11px] leading-tight" : "text-[13px] leading-snug"
            )}>
                {WEEKLY_EXTENSION_NOTICE}
            </p>

            {hasDates && tieredPricing.selectedEstimate !== null && (
                <p className={cn(
                    "pt-1 text-slate-600",
                    isSm ? "text-[11px]" : "text-[13px]"
                )}>
                    Selected dates estimate: <span className="font-semibold text-slate-900">£{tieredPricing.selectedEstimate.toFixed(2)}</span>
                </p>
            )}

            {tieredPricing.usesPercentageFallback && (
                <p className={cn(
                    "pt-0.5 text-amber-700",
                    isSm ? "text-[11px]" : "text-[13px]"
                )}>
                    {TIER_AMOUNT_UNAVAILABLE_MESSAGE}
                </p>
            )}
        </div>
    )
}
