export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string
          sku: string
          name: string
          description: string | null
          category: string | null
          specs: Json
          rental_price: number
          replacement_cost: number
          image_paths: string[]
          status: 'active' | 'maintenance' | 'retired'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          name: string
          description?: string | null
          category?: string | null
          specs?: Json
          rental_price: number
          replacement_cost: number
          image_paths?: string[]
          status?: 'active' | 'maintenance' | 'retired'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          description?: string | null
          category?: string | null
          specs?: Json
          rental_price?: number
          replacement_cost?: number
          image_paths?: string[]
          status?: 'active' | 'maintenance' | 'retired'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          company_name: string | null
          role: 'admin' | 'customer'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          company_name?: string | null
          role?: 'admin' | 'customer'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          company_name?: string | null
          role?: 'admin' | 'customer'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          id: string
          item_id: string
          customer_id: string | null
          renter_id: string | null
          start_date: string
          end_date: string
          status: 'pending' | 'confirmed' | 'active' | 'returned' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
          dispatch_image_paths: string[] | null
          dispatch_notes: string | null
          return_image_paths: string[] | null
          return_notes: string | null
        }
        Insert: {
          id?: string
          item_id: string
          customer_id?: string | null
          renter_id?: string | null
          start_date: string
          end_date: string
          status?: 'pending' | 'confirmed' | 'active' | 'returned' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
          dispatch_image_paths?: string[] | null
          dispatch_notes?: string | null
          return_image_paths?: string[] | null
          return_notes?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          customer_id?: string | null
          renter_id?: string | null
          start_date?: string
          end_date?: string
          status?: 'pending' | 'confirmed' | 'active' | 'returned' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
          dispatch_image_paths?: string[] | null
          dispatch_notes?: string | null
          return_image_paths?: string[] | null
          return_notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_item_available: {
        Args: {
          p_item_id: string
          p_start_at: string
          p_end_at: string
          p_exclude_reservation_id?: string | null
        }
        Returns: boolean
      }
      get_available_items: {
        Args: {
          p_start_at: string
          p_end_at: string
        }
        Returns: Database['public']['Tables']['items']['Row'][]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================
// Convenience Type Aliases
// ============================================================

// Table Row types
export type Item = Database['public']['Tables']['items']['Row']
export type ItemInsert = Database['public']['Tables']['items']['Insert']
export type ItemUpdate = Database['public']['Tables']['items']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Reservation = Database['public']['Tables']['reservations']['Row']
export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']
export type ReservationUpdate = Database['public']['Tables']['reservations']['Update']

// Generic Row helper (usage: Row<'items'>)
export type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

// Generic Insert helper
export type InsertRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

// Generic Update helper
export type UpdateRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// ============================================================
// Domain Types
// ============================================================

// Item specs type (for JSONB field)
export interface ItemSpecs {
  size?: string
  material?: string
  stone?: string
  weight?: string
  [key: string]: string | undefined
}

// Status options for forms
export const ITEM_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
] as const

export const RESERVATION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
] as const
