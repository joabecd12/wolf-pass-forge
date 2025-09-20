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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          password_hash?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          created_at: string | null
          email: string
          error_message: string | null
          html_content: string
          id: string
          max_retries: number
          participant_id: string
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          error_message?: string | null
          html_content: string
          id?: string
          max_retries?: number
          participant_id: string
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          error_message?: string | null
          html_content?: string
          id?: string
          max_retries?: number
          participant_id?: string
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      hubla_raw_events: {
        Row: {
          id: string
          payload: Json
          provider: string
          received_at: string
          transaction_id: string | null
          type: string
        }
        Insert: {
          id?: string
          payload: Json
          provider?: string
          received_at?: string
          transaction_id?: string | null
          type: string
        }
        Update: {
          id?: string
          payload?: Json
          provider?: string
          received_at?: string
          transaction_id?: string | null
          type?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          category: Database["public"]["Enums"]["ticket_category"]
          codigo: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          presencas: Json | null
          short_id: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["ticket_category"]
          codigo?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          presencas?: Json | null
          short_id?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["ticket_category"]
          codigo?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          presencas?: Json | null
          short_id?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          created_at: string
          id: string
          is_validated: boolean
          participant_id: string
          qr_code: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_validated?: boolean
          participant_id: string
          qr_code: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_validated?: boolean
          participant_id?: string
          qr_code?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      validations: {
        Row: {
          id: string
          ip_address: unknown | null
          ticket_id: string
          user_agent: string | null
          validated_at: string
          validated_by: string | null
          validated_by_user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: unknown | null
          ticket_id: string
          user_agent?: string | null
          validated_at?: string
          validated_by?: string | null
          validated_by_user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: unknown | null
          ticket_id?: string
          user_agent?: string | null
          validated_at?: string
          validated_by?: string | null
          validated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_sales_logs: {
        Row: {
          amount_cents: number | null
          assigned_category: string | null
          buyer_email: string | null
          buyer_name: string | null
          created_at: string
          error_message: string | null
          id: string
          name_source: string | null
          offer_id: string | null
          offer_name_v2: string | null
          origin: string
          participant_id: string | null
          phone_source: string | null
          processed_at: string
          product_id: string | null
          product_name: string | null
          raw_payload: Json
          status: string
        }
        Insert: {
          amount_cents?: number | null
          assigned_category?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          name_source?: string | null
          offer_id?: string | null
          offer_name_v2?: string | null
          origin: string
          participant_id?: string | null
          phone_source?: string | null
          processed_at?: string
          product_id?: string | null
          product_name?: string | null
          raw_payload: Json
          status: string
        }
        Update: {
          amount_cents?: number | null
          assigned_category?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          name_source?: string | null
          offer_id?: string | null
          offer_name_v2?: string | null
          origin?: string
          participant_id?: string | null
          phone_source?: string | null
          processed_at?: string
          product_id?: string | null
          product_name?: string | null
          raw_payload?: Json
          status?: string
        }
        Relationships: []
      }
      wolf_sales: {
        Row: {
          created_at: string | null
          offer_name: string | null
          paid_at: string | null
          product_name: string | null
          total_amount: number | null
          transaction_id: string
          user_email: string
          user_name: string | null
          user_phone: string | null
        }
        Insert: {
          created_at?: string | null
          offer_name?: string | null
          paid_at?: string | null
          product_name?: string | null
          total_amount?: number | null
          transaction_id: string
          user_email: string
          user_name?: string | null
          user_phone?: string | null
        }
        Update: {
          created_at?: string | null
          offer_name?: string | null
          paid_at?: string | null
          product_name?: string | null
          total_amount?: number | null
          transaction_id?: string
          user_email?: string
          user_name?: string | null
          user_phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_name: {
        Args: { input_name: string }
        Returns: string
      }
    }
    Enums: {
      ticket_category: "Wolf Gold" | "Wolf Black" | "VIP Wolf" | "Camarote"
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
      ticket_category: ["Wolf Gold", "Wolf Black", "VIP Wolf", "Camarote"],
    },
  },
} as const
