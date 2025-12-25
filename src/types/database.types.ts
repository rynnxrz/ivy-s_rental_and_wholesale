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
          ai_import_prompt: string | null
          ai_max_output_tokens: number | null
          ai_model: string | null
          ai_prompt_category: string | null
          ai_prompt_product_detail: string | null
          ai_prompt_product_list: string | null
          ai_prompt_quick_list: string | null
          ai_prompt_subcategory: string | null
          ai_selected_model: string | null
          ai_thinking_category: string | null
          ai_thinking_product_detail: string | null
          ai_thinking_product_list: string | null
          ai_thinking_subcategory: string | null
          ai_use_system_instruction: boolean | null
          bank_info: string | null
          booking_password: string | null
          company_name: string | null
          contact_email: string | null
          email_approval_body: string | null
          email_footer: string | null
          email_shipping_body: string | null
          email_shipping_footer: string | null
          email_shipping_subject: string | null
          footer_text: string | null
          id: number
          invoice_default_notes: string | null
          invoice_footer_text: string | null
          invoice_notes_default: string | null
          prompt_history: Json | null
          turnaround_buffer: number | null
          updated_at: string | null
        }
        Insert: {
          ai_import_prompt?: string | null
          ai_max_output_tokens?: number | null
          ai_model?: string | null
          ai_prompt_category?: string | null
          ai_prompt_product_detail?: string | null
          ai_prompt_product_list?: string | null
          ai_prompt_quick_list?: string | null
          ai_prompt_subcategory?: string | null
          ai_selected_model?: string | null
          ai_thinking_category?: string | null
          ai_thinking_product_detail?: string | null
          ai_thinking_product_list?: string | null
          ai_thinking_subcategory?: string | null
          ai_use_system_instruction?: boolean | null
          bank_info?: string | null
          booking_password?: string | null
          company_name?: string | null
          contact_email?: string | null
          email_approval_body?: string | null
          email_footer?: string | null
          email_shipping_body?: string | null
          email_shipping_footer?: string | null
          email_shipping_subject?: string | null
          footer_text?: string | null
          id?: number
          invoice_default_notes?: string | null
          invoice_footer_text?: string | null
          invoice_notes_default?: string | null
          prompt_history?: Json | null
          turnaround_buffer?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_import_prompt?: string | null
          ai_max_output_tokens?: number | null
          ai_model?: string | null
          ai_prompt_category?: string | null
          ai_prompt_product_detail?: string | null
          ai_prompt_product_list?: string | null
          ai_prompt_quick_list?: string | null
          ai_prompt_subcategory?: string | null
          ai_selected_model?: string | null
          ai_thinking_category?: string | null
          ai_thinking_product_detail?: string | null
          ai_thinking_product_list?: string | null
          ai_thinking_subcategory?: string | null
          ai_use_system_instruction?: boolean | null
          bank_info?: string | null
          booking_password?: string | null
          company_name?: string | null
          contact_email?: string | null
          email_approval_body?: string | null
          email_footer?: string | null
          email_shipping_body?: string | null
          email_shipping_footer?: string | null
          email_shipping_subject?: string | null
          footer_text?: string | null
          id?: number
          invoice_default_notes?: string | null
          invoice_footer_text?: string | null
          invoice_notes_default?: string | null
          prompt_history?: Json | null
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
      categories: {
        Row: {
          created_at: string
          hidden_in_portal: boolean | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          hidden_in_portal?: boolean | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          hidden_in_portal?: boolean | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          hidden_in_portal: boolean | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          hidden_in_portal?: boolean | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          hidden_in_portal?: boolean | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          agent_logs: Json | null
          category_mapping: Json | null
          created_at: string
          current_collection_index: number | null
          id: string
          last_raw_scrape: string | null
          processed_urls: Json | null
          shop_url: string
          staging_products: Json | null
          status: Database["public"]["Enums"]["import_job_status"]
          updated_at: string
        }
        Insert: {
          agent_logs?: Json | null
          category_mapping?: Json | null
          created_at?: string
          current_collection_index?: number | null
          id?: string
          last_raw_scrape?: string | null
          processed_urls?: Json | null
          shop_url: string
          staging_products?: Json | null
          status?: Database["public"]["Enums"]["import_job_status"]
          updated_at?: string
        }
        Update: {
          agent_logs?: Json | null
          category_mapping?: Json | null
          created_at?: string
          current_collection_index?: number | null
          id?: string
          last_raw_scrape?: string | null
          processed_urls?: Json | null
          shop_url?: string
          staging_products?: Json | null
          status?: Database["public"]["Enums"]["import_job_status"]
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          item_id: string | null
          name: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          item_id?: string | null
          name: string
          quantity?: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          item_id?: string | null
          name?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_address: Json | null
          billing_profile_id: string | null
          category: Database["public"]["Enums"]["invoice_category"]
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          reservation_id: string | null
          signed_file_path: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          billing_profile_id?: string | null
          category: Database["public"]["Enums"]["invoice_category"]
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          reservation_id?: string | null
          signed_file_path?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          billing_profile_id?: string | null
          category?: Database["public"]["Enums"]["invoice_category"]
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          reservation_id?: string | null
          signed_file_path?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billing_profile_id_fkey"
            columns: ["billing_profile_id"]
            isOneToOne: false
            referencedRelation: "billing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          category_id: string | null
          collection_id: string | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          image_paths: string[] | null
          import_batch_id: string | null
          is_ai_generated: boolean | null
          is_ai_imported: boolean | null
          material: string | null
          name: string
          owner_id: string | null
          priority: number | null
          rental_price: number
          replacement_cost: number
          sku: string | null
          source_url: string | null
          specs: Json | null
          status: string | null
          weight: string | null
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          collection_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_paths?: string[] | null
          import_batch_id?: string | null
          is_ai_generated?: boolean | null
          is_ai_imported?: boolean | null
          material?: string | null
          name: string
          owner_id?: string | null
          priority?: number | null
          rental_price: number
          replacement_cost?: number
          sku?: string | null
          source_url?: string | null
          specs?: Json | null
          status?: string | null
          weight?: string | null
        }
        Update: {
          category?: string | null
          category_id?: string | null
          collection_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_paths?: string[] | null
          import_batch_id?: string | null
          is_ai_generated?: boolean | null
          is_ai_imported?: boolean | null
          material?: string | null
          name?: string
          owner_id?: string | null
          priority?: number | null
          rental_price?: number
          replacement_cost?: number
          sku?: string | null
          source_url?: string | null
          specs?: Json | null
          status?: string | null
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
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
          address_line1: string | null
          address_line2: string | null
          avatar_url: string | null
          city_region: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          organization_domain: string | null
          postcode: string | null
          role: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city_region?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          organization_domain?: string | null
          postcode?: string | null
          role?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city_region?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          organization_domain?: string | null
          postcode?: string | null
          role?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city_region: string | null
          country: string | null
          created_at: string | null
          customer_id: string | null
          dispatch_image_paths: string[] | null
          dispatch_notes: string | null
          end_date: string
          group_id: string | null
          id: string
          item_id: string
          postcode: string | null
          renter_id: string
          return_image_paths: string[] | null
          return_notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["reservation_status"] | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city_region?: string | null
          country?: string | null
          created_at?: string | null
          customer_id?: string | null
          dispatch_image_paths?: string[] | null
          dispatch_notes?: string | null
          end_date: string
          group_id?: string | null
          id?: string
          item_id: string
          postcode?: string | null
          renter_id: string
          return_image_paths?: string[] | null
          return_notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["reservation_status"] | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city_region?: string | null
          country?: string | null
          created_at?: string | null
          customer_id?: string | null
          dispatch_image_paths?: string[] | null
          dispatch_notes?: string | null
          end_date?: string
          group_id?: string | null
          id?: string
          item_id?: string
          postcode?: string | null
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
      staging_imports: {
        Row: {
          created_at: string | null
          current_category: string | null
          id: string
          items_scraped: number | null
          items_total: number | null
          last_scanned_index: number | null
          product_urls: string[] | null
          source_url: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          current_category?: string | null
          id?: string
          items_scraped?: number | null
          items_total?: number | null
          last_scanned_index?: number | null
          product_urls?: string[] | null
          source_url: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          current_category?: string | null
          id?: string
          items_scraped?: number | null
          items_total?: number | null
          last_scanned_index?: number | null
          product_urls?: string[] | null
          source_url?: string
          status?: string | null
        }
        Relationships: []
      }
      staging_items: {
        Row: {
          category_id: string | null
          collection_id: string | null
          color: string | null
          created_at: string | null
          description: string | null
          enriched_at: string | null
          id: string
          image_urls: string[] | null
          import_batch_id: string | null
          is_variant: boolean | null
          material: string | null
          name: string
          needs_enrichment: boolean | null
          parent_product_id: string | null
          rental_price: number | null
          replacement_cost: number | null
          review_notes: string | null
          sku: string | null
          source_url: string | null
          status: string | null
          variant_of_name: string | null
          weight: string | null
        }
        Insert: {
          category_id?: string | null
          collection_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          enriched_at?: string | null
          id?: string
          image_urls?: string[] | null
          import_batch_id?: string | null
          is_variant?: boolean | null
          material?: string | null
          name: string
          needs_enrichment?: boolean | null
          parent_product_id?: string | null
          rental_price?: number | null
          replacement_cost?: number | null
          review_notes?: string | null
          sku?: string | null
          source_url?: string | null
          status?: string | null
          variant_of_name?: string | null
          weight?: string | null
        }
        Update: {
          category_id?: string | null
          collection_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          enriched_at?: string | null
          id?: string
          image_urls?: string[] | null
          import_batch_id?: string | null
          is_variant?: boolean | null
          material?: string | null
          name?: string
          needs_enrichment?: boolean | null
          parent_product_id?: string | null
          rental_price?: number | null
          replacement_cost?: number | null
          review_notes?: string | null
          sku?: string | null
          source_url?: string | null
          status?: string | null
          variant_of_name?: string | null
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staging_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_items_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "staging_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_items_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "staging_items"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_products: {
        Row: {
          created_at: string | null
          id: string
          raw_data: Json | null
          source_url: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          raw_data?: Json | null
          source_url?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          raw_data?: Json | null
          source_url?: string | null
          status?: string | null
        }
        Relationships: []
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
      commit_staging_batch: {
        Args: { p_batch_id: string }
        Returns: {
          error_message: string
          imported_count: number
        }[]
      }
      generate_invoice_number: {
        Args: { p_category: Database["public"]["Enums"]["invoice_category"] }
        Returns: string
      }
      get_available_items: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          category: string | null
          category_id: string | null
          collection_id: string | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          image_paths: string[] | null
          import_batch_id: string | null
          is_ai_generated: boolean | null
          is_ai_imported: boolean | null
          material: string | null
          name: string
          owner_id: string | null
          priority: number | null
          rental_price: number
          replacement_cost: number
          sku: string | null
          source_url: string | null
          specs: Json | null
          status: string | null
          weight: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_available_items_v2: {
        Args: {
          p_end_date: string
          p_include_booked?: boolean
          p_start_date: string
        }
        Returns: {
          category: string
          category_id: string
          collection_id: string
          color: string
          conflict_dates: string
          id: string
          image_paths: string[]
          is_booked: boolean
          name: string
          priority: number
          rental_price: number
          status: string
        }[]
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
      import_job_status: "pending" | "processing" | "completed" | "failed"
      invoice_category: "RENTAL" | "WHOLESALE" | "MANUAL"
      invoice_status: "DRAFT" | "SENT" | "PAID" | "VOID" | "OVERDUE"
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
      import_job_status: ["pending", "processing", "completed", "failed"],
      invoice_category: ["RENTAL", "WHOLESALE", "MANUAL"],
      invoice_status: ["DRAFT", "SENT", "PAID", "VOID", "OVERDUE"],
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
