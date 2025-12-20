export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          bank_info: string | null
          company_name: string | null
          contact_email: string | null
          footer_text: string | null
          id: number
          turnaround_buffer: number | null
          updated_at: string | null
        }
        Insert: {
          bank_info?: string | null
          company_name?: string | null
          contact_email?: string | null
          footer_text?: string | null
          id?: number
          turnaround_buffer?: number | null
          updated_at?: string | null
        }
        Update: {
          bank_info?: string | null
          company_name?: string | null
          contact_email?: string | null
          footer_text?: string | null
          id?: number
          turnaround_buffer?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      billing_profiles: {
        Row: {
          bank_info: string
          company_header: string
          contact_email: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          profile_name: string
          updated_at: string | null
        }
        Insert: {
          bank_info: string
          company_header: string
          contact_email?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          profile_name: string
          updated_at?: string | null
        }
        Update: {
          bank_info?: string
          company_header?: string
          contact_email?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          profile_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_paths: string[] | null
          name: string
          owner_id: string | null
          rental_price: number
          replacement_cost: number
          sku: string | null
          specs: Json | null
          status: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_paths?: string[] | null
          name: string
          owner_id?: string | null
          rental_price: number
          replacement_cost?: number
          sku?: string | null
          specs?: Json | null
          status?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_paths?: string[] | null
          name?: string
          owner_id?: string | null
          rental_price?: number
          replacement_cost?: number
          sku?: string | null
          specs?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string | null
          customer_id: string | null
          dispatch_image_paths: string[] | null
          dispatch_notes: string | null
          end_date: string
          id: string
          item_id: string
          renter_id: string
          return_image_paths: string[] | null
          return_notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["reservation_status"] | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          dispatch_image_paths?: string[] | null
          dispatch_notes?: string | null
          end_date: string
          id?: string
          item_id: string
          renter_id: string
          return_image_paths?: string[] | null
          return_notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["reservation_status"] | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          dispatch_image_paths?: string[] | null
          dispatch_notes?: string | null
          end_date?: string
          id?: string
          item_id?: string
          renter_id?: string
          return_image_paths?: string[] | null
          return_notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["reservation_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_item_availability: {
        Args: {
          p_end_date: string
          p_exclude_reservation_id?: string
          p_item_id: string
          p_start_date: string
        }
        Returns: boolean
      }
      get_unavailable_date_ranges: {
        Args: { p_item_id: string }
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      restore_reservation: { Args: { p_reservation_id: string }; Returns: Json }
    }
    Enums: {
      reservation_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "active"
        | "returned"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      reservation_status: [
        "pending",
        "confirmed",
        "cancelled",
        "active",
        "returned",
        "archived",
      ],
    },
  },
} as const
