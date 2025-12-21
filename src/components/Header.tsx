"use client"

import { RequestFloatingButton } from "@/components/RequestFloatingButton"
import Link from "next/link"

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between px-4 sm:px-8 max-w-[1920px] mx-auto">
                {/* Project Name / Logo */}
                <Link href="/" className="text-xl font-light tracking-widest text-gray-900 hover:opacity-70 transition-opacity">
                    IVY'S RENTAL
                </Link>

                {/* Cart Action */}
                <RequestFloatingButton />
            </div>
        </header>
    )
}
