import { Skeleton } from "@/components/ui/skeleton"

export function PortalGridSkeleton() {
    return (
        <div className="min-h-screen bg-white">
            {/* Layout Container */}
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-0 pb-6 flex flex-col md:flex-row gap-6">

                {/* Sidebar Skeleton */}
                <aside className="w-full md:w-48 lg:w-56 space-y-10 flex-shrink-0 pt-1 hidden md:block">
                    {/* Date Picker Skeleton */}
                    <div>
                        <div className="mb-4 pb-2 border-b border-slate-100">
                            <Skeleton className="h-3 w-20 bg-slate-200" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full bg-slate-100 rounded-sm" />
                            <Skeleton className="h-10 w-full bg-slate-100 rounded-sm" />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                            <Skeleton className="h-3 w-20 bg-slate-200" />
                        </div>
                        <ul className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <li key={i} className="flex justify-between items-center">
                                    <Skeleton className="h-4 w-24 bg-slate-100" />
                                    <Skeleton className="h-3 w-6 bg-slate-50" />
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                            <Skeleton className="h-3 w-20 bg-slate-200" />
                        </div>
                        <ul className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <li key={i} className="flex justify-between items-center">
                                    <Skeleton className="h-4 w-24 bg-slate-100" />
                                    <Skeleton className="h-3 w-6 bg-slate-50" />
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* Grid Skeleton */}
                <section className="flex-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {Array.from({ length: 15 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                {/* Image Skeleton */}
                                <Skeleton className="w-full aspect-square rounded-sm bg-slate-100" />
                                {/* Text Skeleton */}
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-3/4 bg-slate-100" />
                                    <div className="flex justify-between">
                                        <Skeleton className="h-3 w-1/3 bg-slate-50" />
                                        <Skeleton className="h-3 w-1/4 bg-slate-50" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
