"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="light"
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-950 group-[.toaster]:border-border group-[.toaster]:shadow-lg",
                    description: "group-[.toaster]:text-gray-500",
                    actionButton:
                        "group-[.toaster]:bg-gray-900 group-[.toaster]:text-gray-50",
                    cancelButton:
                        "group-[.toaster]:bg-gray-100 group-[.toaster]:text-gray-500",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
