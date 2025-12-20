import { SkeletonTable } from "@/components/SkeletonTable"

export default function Loading() {
    return (
        <div className="h-full flex-1 flex-col space-y-8 p-8 md:flex">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Reservations</h2>
                    <p className="text-muted-foreground">Loading bookings...</p>
                </div>
            </div>
            <SkeletonTable />
        </div>
    )
}
