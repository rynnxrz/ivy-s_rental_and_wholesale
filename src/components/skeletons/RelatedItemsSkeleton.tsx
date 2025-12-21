import { Skeleton } from "@/components/ui/skeleton"

export function RelatedItemsSkeleton() {
    return (
        <section className="mt-24 pt-12 border-t border-gray-100">
            <div className="flex justify-center mb-12">
                <Skeleton className="h-8 w-64 bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-4">
                        <Skeleton className="aspect-square w-full rounded-sm bg-slate-100" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4 bg-slate-100" />
                            <Skeleton className="h-3 w-1/4 bg-slate-50" />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
