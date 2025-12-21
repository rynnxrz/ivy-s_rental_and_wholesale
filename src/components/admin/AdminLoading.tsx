import { SkeletonTable } from "@/components/SkeletonTable"

interface AdminLoadingProps {
    title: string
    description: string
}

export function AdminLoading({ title, description }: AdminLoadingProps) {
    return (
        <div className="h-full flex-1 flex-col space-y-8 p-8 md:flex">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                    <p className="text-muted-foreground">{description}</p>
                </div>
            </div>
            <SkeletonTable />
        </div>
    )
}
