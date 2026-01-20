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
      audit_events: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      consent_agreements: {
        Row: {
          created_at: string
          id: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scope: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      consent_snapshots: {
        Row: {
          consent_agreement_id: string
          created_at: string
          id: string
          permissions: Json
        }
        Insert: {
          consent_agreement_id: string
          created_at?: string
          id?: string
          permissions: Json
        }
        Update: {
          consent_agreement_id?: string
          created_at?: string
          id?: string
          permissions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "consent_snapshots_consent_agreement_id_fkey"
            columns: ["consent_agreement_id"]
            isOneToOne: false
            referencedRelation: "consent_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["data_source_status"]
          type: Database["public"]["Enums"]["data_source_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["data_source_status"]
          type: Database["public"]["Enums"]["data_source_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["data_source_status"]
          type?: Database["public"]["Enums"]["data_source_type"]
          user_id?: string
        }
        Relationships: []
      }
      document_artifacts: {
        Row: {
          content_type: string
          created_at: string
          id: string
          provenance_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          content_type: string
          created_at?: string
          id?: string
          provenance_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          id?: string
          provenance_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_artifacts_provenance_id_fkey"
            columns: ["provenance_id"]
            isOneToOne: false
            referencedRelation: "provenance"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          job_type: string
          status: Database["public"]["Enums"]["job_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          job_type: string
          status?: Database["public"]["Enums"]["job_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          job_type?: string
          status?: Database["public"]["Enums"]["job_status"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      provenance: {
        Row: {
          captured_at: string
          data_source_id: string
          id: string
          method: Database["public"]["Enums"]["provenance_method"]
        }
        Insert: {
          captured_at?: string
          data_source_id: string
          id?: string
          method: Database["public"]["Enums"]["provenance_method"]
        }
        Update: {
          captured_at?: string
          data_source_id?: string
          id?: string
          method?: Database["public"]["Enums"]["provenance_method"]
        }
        Relationships: [
          {
            foreignKeyName: "provenance_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          consent_snapshot_id: string
          created_at: string
          event_time: string
          event_type: string
          id: string
          provenance_id: string
          summary: string
          user_id: string
        }
        Insert: {
          consent_snapshot_id: string
          created_at?: string
          event_time: string
          event_type: string
          id?: string
          provenance_id: string
          summary: string
          user_id: string
        }
        Update: {
          consent_snapshot_id?: string
          created_at?: string
          event_time?: string
          event_type?: string
          id?: string
          provenance_id?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_consent_snapshot_id_fkey"
            columns: ["consent_snapshot_id"]
            isOneToOne: false
            referencedRelation: "consent_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_provenance_id_fkey"
            columns: ["provenance_id"]
            isOneToOne: false
            referencedRelation: "provenance"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      data_source_status: "active" | "inactive" | "pending"
      data_source_type: "manual" | "upload" | "portal"
      job_status: "pending" | "running" | "complete" | "failed"
      provenance_method: "manual_entry" | "upload" | "portal_import"
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
      data_source_status: ["active", "inactive", "pending"],
      data_source_type: ["manual", "upload", "portal"],
      job_status: ["pending", "running", "complete", "failed"],
      provenance_method: ["manual_entry", "upload", "portal_import"],
    },
  },
} as const
