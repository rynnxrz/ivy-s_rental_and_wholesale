import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

export default function RequestSuccessPage() {
    return (
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-white flex items-center justify-center px-4" aria-label="Request submitted confirmation">
            <div className="max-w-md w-full text-center space-y-8">
                <div className="flex justify-center">
                    <div className="h-24 w-24 bg-green-50 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden="true" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl font-light text-gray-900 tracking-tight">Request Sent!</h1>
                    <p className="text-gray-500">
                        We have received your inquiry. Ivy will review your request and get back to you shortly with availability confirmation.
                    </p>
                </div>

                <div className="pt-4">
                    <Link href="/">
                        <Button className="w-full h-12 uppercase tracking-widest text-sm">
                            Return to Collection
                        </Button>
                    </Link>
                </div>
            </div>
        </main>
    )
}
