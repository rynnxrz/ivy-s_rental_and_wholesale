import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Item {
    id: string
    name: string
    category: string
    rental_price: number
    image_paths: string[] | null
    status: string
}

interface ContactInfo {
    full_name: string
    email: string
    company_name: string
    notes: string
    access_password: string
    country: string
    city_region: string
    address_line1: string
    address_line2: string
    postcode: string
}

interface RequestState {
    dateRange: {
        from: string | null
        to: string | null
    }
    items: Item[]
    contactInfo: ContactInfo

    updatedAt: number

    // Actions
    setDateRange: (range: { from: string | null; to: string | null }) => void
    addItem: (item: Item) => void
    removeItem: (itemId: string) => void
    clearRequest: () => void
    hasItem: (itemId: string) => boolean
    setContactInfo: (info: Partial<ContactInfo>) => void
    checkExpiry: () => void
}

export const useRequestStore = create<RequestState>()(
    persist(
        (set, get) => ({
            dateRange: { from: null, to: null },
            items: [],
            contactInfo: {
                full_name: '',
                email: '',
                company_name: '',
                notes: '',
                access_password: '',
                country: '',
                city_region: '',
                address_line1: '',
                address_line2: '',
                postcode: ''
            },
            updatedAt: Date.now(),

            setDateRange: (range) => set({ dateRange: range, updatedAt: Date.now() }),

            addItem: (item) => {
                const { items } = get()
                if (!items.find((i) => i.id === item.id)) {
                    set({ items: [...items, item], updatedAt: Date.now() })
                }
            },

            removeItem: (itemId) => {
                set({ items: get().items.filter((i) => i.id !== itemId), updatedAt: Date.now() })
            },

            clearRequest: () => set({
                dateRange: { from: null, to: null },
                items: [],
                contactInfo: {
                    full_name: '',
                    email: '',
                    company_name: '',
                    notes: '',
                    access_password: '',
                    country: '',
                    city_region: '',
                    address_line1: '',
                    address_line2: '',
                    postcode: ''
                },
                updatedAt: Date.now()
            }),

            hasItem: (itemId) => !!get().items.find((i) => i.id === itemId),

            setContactInfo: (info) => set((state) => ({
                contactInfo: { ...state.contactInfo, ...info },
                updatedAt: Date.now()
            })),

            checkExpiry: () => {
                const { updatedAt, clearRequest } = get()
                const oneDay = 24 * 60 * 60 * 1000
                if (Date.now() - updatedAt > oneDay) {
                    clearRequest()
                }
            }
        }),
        {
            name: 'request-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                state?.checkExpiry()
            }
        }
    )
)
