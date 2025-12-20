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

interface RequestState {
    dateRange: {
        from: string | null
        to: string | null
    }
    items: Item[]

    // Actions
    setDateRange: (range: { from: string | null; to: string | null }) => void
    addItem: (item: Item) => void
    removeItem: (itemId: string) => void
    clearRequest: () => void
    hasItem: (itemId: string) => boolean
}

export const useRequestStore = create<RequestState>()(
    persist(
        (set, get) => ({
            dateRange: { from: null, to: null },
            items: [],

            setDateRange: (range) => set({ dateRange: range }),

            addItem: (item) => {
                const { items } = get()
                if (!items.find((i) => i.id === item.id)) {
                    set({ items: [...items, item] })
                }
            },

            removeItem: (itemId) => {
                set({ items: get().items.filter((i) => i.id !== itemId) })
            },

            clearRequest: () => set({ dateRange: { from: null, to: null }, items: [] }),

            hasItem: (itemId) => !!get().items.find((i) => i.id === itemId),
        }),
        {
            name: 'request-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
