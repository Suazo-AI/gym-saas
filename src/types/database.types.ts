export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_devices: {
        Row: {
          api_key_hash: string | null
          branch_id: string
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          device_type: string
          gym_id: string
          id: string
          last_seen_at: string | null
          name: string
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          api_key_hash?: string | null
          branch_id: string
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          device_type?: string
          gym_id: string
          id?: string
          last_seen_at?: string | null
          name: string
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          api_key_hash?: string | null
          branch_id?: string
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          device_type?: string
          gym_id?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_devices_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_devices_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      alert_types: {
        Row: {
          code: string
          created_at: string
          default_severity: Database["public"]["Enums"]["alert_severity"]
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          default_severity?: Database["public"]["Enums"]["alert_severity"]
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          default_severity?: Database["public"]["Enums"]["alert_severity"]
          id?: string
          name?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          entity_id: string | null
          entity_schema: string
          entity_table: string
          gym_id: string | null
          id: number
          ip_address: unknown
          occurred_at: string
          request_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string | null
          entity_schema?: string
          entity_table: string
          gym_id?: string | null
          id?: never
          ip_address?: unknown
          occurred_at?: string
          request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string | null
          entity_schema?: string
          entity_table?: string
          gym_id?: string | null
          id?: never
          ip_address?: unknown
          occurred_at?: string
          request_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      biometric_consents: {
        Row: {
          consent_version: string
          created_at: string
          evidence_media_asset_id: string | null
          expires_at: string | null
          gym_id: string
          id: string
          obtained_at: string
          obtained_by: string | null
          person_id: string
          purpose: string
          retention_until: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["biometric_consent_status"]
        }
        Insert: {
          consent_version: string
          created_at?: string
          evidence_media_asset_id?: string | null
          expires_at?: string | null
          gym_id: string
          id?: string
          obtained_at?: string
          obtained_by?: string | null
          person_id: string
          purpose?: string
          retention_until?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["biometric_consent_status"]
        }
        Update: {
          consent_version?: string
          created_at?: string
          evidence_media_asset_id?: string | null
          expires_at?: string | null
          gym_id?: string
          id?: string
          obtained_at?: string
          obtained_by?: string | null
          person_id?: string
          purpose?: string
          retention_until?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["biometric_consent_status"]
        }
        Relationships: [
          {
            foreignKeyName: "biometric_consents_evidence_media_asset_id_fkey"
            columns: ["evidence_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_consents_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_consents_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "biometric_consents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "biometric_consents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "biometric_consents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_consents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
        ]
      }
      face_embeddings: {
        Row: {
          created_at: string
          embedding: string
          face_model_id: string
          gym_id: string
          id: string
          is_active: boolean
          person_id: string
          person_photo_id: string
          quality_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          embedding: string
          face_model_id: string
          gym_id: string
          id?: string
          is_active?: boolean
          person_id: string
          person_photo_id: string
          quality_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          embedding?: string
          face_model_id?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          person_id?: string
          person_photo_id?: string
          quality_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_embeddings_face_model_id_fkey"
            columns: ["face_model_id"]
            isOneToOne: false
            referencedRelation: "face_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_embeddings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_embeddings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "face_embeddings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "face_embeddings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "face_embeddings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_embeddings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "face_embeddings_person_photo_id_fkey"
            columns: ["person_photo_id"]
            isOneToOne: false
            referencedRelation: "person_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      face_models: {
        Row: {
          code: string
          created_at: string
          default_similarity_threshold: number
          id: string
          is_active: boolean
          vector_dimensions: number
          version: string
        }
        Insert: {
          code: string
          created_at?: string
          default_similarity_threshold?: number
          id?: string
          is_active?: boolean
          vector_dimensions?: number
          version: string
        }
        Update: {
          code?: string
          created_at?: string
          default_similarity_threshold?: number
          id?: string
          is_active?: boolean
          vector_dimensions?: number
          version?: string
        }
        Relationships: []
      }
      face_recognition_events: {
        Row: {
          branch_id: string | null
          captured_media_asset_id: string | null
          decision: Database["public"]["Enums"]["access_decision"]
          decision_reason: string | null
          device_id: string | null
          gym_id: string
          gym_member_id: string | null
          id: string
          matched_face_embedding_id: string | null
          matched_person_id: string | null
          metadata: Json
          model_code: string | null
          occurred_at: string
          processing_ms: number | null
          similarity_score: number | null
        }
        Insert: {
          branch_id?: string | null
          captured_media_asset_id?: string | null
          decision: Database["public"]["Enums"]["access_decision"]
          decision_reason?: string | null
          device_id?: string | null
          gym_id: string
          gym_member_id?: string | null
          id?: string
          matched_face_embedding_id?: string | null
          matched_person_id?: string | null
          metadata?: Json
          model_code?: string | null
          occurred_at?: string
          processing_ms?: number | null
          similarity_score?: number | null
        }
        Update: {
          branch_id?: string | null
          captured_media_asset_id?: string | null
          decision?: Database["public"]["Enums"]["access_decision"]
          decision_reason?: string | null
          device_id?: string | null
          gym_id?: string
          gym_member_id?: string | null
          id?: string
          matched_face_embedding_id?: string | null
          matched_person_id?: string | null
          metadata?: Json
          model_code?: string | null
          occurred_at?: string
          processing_ms?: number | null
          similarity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "face_recognition_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_recognition_events_captured_media_asset_id_fkey"
            columns: ["captured_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_recognition_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_recognition_events_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_recognition_events_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "face_recognition_events_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "face_recognition_events_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "face_recognition_events_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "gym_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_recognition_events_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "face_recognition_events_matched_face_embedding_id_fkey"
            columns: ["matched_face_embedding_id"]
            isOneToOne: false
            referencedRelation: "face_embeddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_recognition_events_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "face_recognition_events_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "face_recognition_events_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_recognition_events_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
        ]
      }
      gym_alert_recipients: {
        Row: {
          delivered_at: string | null
          gym_alert_id: string
          gym_user_id: string
          read_at: string | null
        }
        Insert: {
          delivered_at?: string | null
          gym_alert_id: string
          gym_user_id: string
          read_at?: string | null
        }
        Update: {
          delivered_at?: string | null
          gym_alert_id?: string
          gym_user_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_alert_recipients_gym_alert_id_fkey"
            columns: ["gym_alert_id"]
            isOneToOne: false
            referencedRelation: "gym_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_alert_recipients_gym_user_id_fkey"
            columns: ["gym_user_id"]
            isOneToOne: false
            referencedRelation: "gym_users"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type_id: string
          branch_id: string | null
          created_at: string
          face_recognition_event_id: string | null
          gym_id: string
          gym_member_id: string | null
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type_id: string
          branch_id?: string | null
          created_at?: string
          face_recognition_event_id?: string | null
          gym_id: string
          gym_member_id?: string | null
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type_id?: string
          branch_id?: string | null
          created_at?: string
          face_recognition_event_id?: string | null
          gym_id?: string
          gym_member_id?: string | null
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_alerts_alert_type_id_fkey"
            columns: ["alert_type_id"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_alerts_face_recognition_event_id_fkey"
            columns: ["face_recognition_event_id"]
            isOneToOne: false
            referencedRelation: "face_recognition_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_alerts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_alerts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "gym_alerts_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "gym_alerts_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "gym_alerts_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "gym_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_alerts_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["gym_member_id"]
          },
        ]
      }
      gym_branches: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          code: string
          country_code: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          department_state: string | null
          email: string | null
          gym_id: string
          id: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["record_status"]
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code: string
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          department_state?: string | null
          email?: string | null
          gym_id: string
          id?: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          department_state?: string | null
          email?: string | null
          gym_id?: string
          id?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_branches_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_branches_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      gym_members: {
        Row: {
          blocked_reason: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          gym_id: string
          home_branch_id: string | null
          id: string
          joined_on: string | null
          member_code: string
          person_id: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          gym_id: string
          home_branch_id?: string | null
          id?: string
          joined_on?: string | null
          member_code: string
          person_id: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          gym_id?: string
          home_branch_id?: string | null
          id?: string
          joined_on?: string | null
          member_code?: string
          person_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "gym_members_home_branch_id_fkey"
            columns: ["home_branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "gym_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "gym_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
        ]
      }
      gym_saas_subscription_events: {
        Row: {
          actor_user_id: string | null
          gym_saas_subscription_id: string
          id: number
          new_status: Database["public"]["Enums"]["subscription_status"]
          occurred_at: string
          previous_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          reason: string | null
        }
        Insert: {
          actor_user_id?: string | null
          gym_saas_subscription_id: string
          id?: never
          new_status: Database["public"]["Enums"]["subscription_status"]
          occurred_at?: string
          previous_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          reason?: string | null
        }
        Update: {
          actor_user_id?: string | null
          gym_saas_subscription_id?: string
          id?: never
          new_status?: Database["public"]["Enums"]["subscription_status"]
          occurred_at?: string
          previous_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_saas_subscription_events_gym_saas_subscription_id_fkey"
            columns: ["gym_saas_subscription_id"]
            isOneToOne: false
            referencedRelation: "gym_saas_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_saas_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          ended_at: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          gym_id: string
          id: string
          saas_plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          ended_at?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          gym_id: string
          id?: string
          saas_plan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          ended_at?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          gym_id?: string
          id?: string
          saas_plan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_saas_subscriptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_saas_subscriptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "gym_saas_subscriptions_saas_plan_id_fkey"
            columns: ["saas_plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          gym_user_id: string
          role_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          gym_user_id: string
          role_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          gym_user_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_user_roles_gym_user_id_fkey"
            columns: ["gym_user_id"]
            isOneToOne: false
            referencedRelation: "gym_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_users: {
        Row: {
          accepted_at: string | null
          auth_user_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          employee_code: string | null
          gym_id: string
          id: string
          invited_at: string
          invited_by: string | null
          status: Database["public"]["Enums"]["user_membership_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          auth_user_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          employee_code?: string | null
          gym_id: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["user_membership_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          auth_user_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          employee_code?: string | null
          gym_id?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["user_membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_users_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_users_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      gyms: {
        Row: {
          created_at: string
          created_by: string
          default_currency: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          id: string
          legal_name: string
          slug: string
          status: Database["public"]["Enums"]["record_status"]
          tax_identifier: string | null
          timezone: string
          trade_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          default_currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          legal_name: string
          slug: string
          status?: Database["public"]["Enums"]["record_status"]
          tax_identifier?: string | null
          timezone?: string
          trade_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          legal_name?: string
          slug?: string
          status?: Database["public"]["Enums"]["record_status"]
          tax_identifier?: string | null
          timezone?: string
          trade_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      income_categories: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          gym_id: string
          id: string
          is_active: boolean
          is_membership_related: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          is_membership_related?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          is_membership_related?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_categories_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_categories_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      media_assets: {
        Row: {
          bucket_name: string
          compression_codec: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          gym_id: string
          height_pixels: number | null
          id: string
          mime_type: string
          object_path: string
          original_filename: string | null
          owner_person_id: string | null
          sha256_hex: string | null
          size_bytes: number
          storage_deleted_at: string | null
          updated_at: string
          width_pixels: number | null
        }
        Insert: {
          bucket_name?: string
          compression_codec?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          gym_id: string
          height_pixels?: number | null
          id?: string
          mime_type: string
          object_path: string
          original_filename?: string | null
          owner_person_id?: string | null
          sha256_hex?: string | null
          size_bytes?: number
          storage_deleted_at?: string | null
          updated_at?: string
          width_pixels?: number | null
        }
        Update: {
          bucket_name?: string
          compression_codec?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          gym_id?: string
          height_pixels?: number | null
          id?: string
          mime_type?: string
          object_path?: string
          original_filename?: string | null
          owner_person_id?: string | null
          sha256_hex?: string | null
          size_bytes?: number
          storage_deleted_at?: string | null
          updated_at?: string
          width_pixels?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "media_assets_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "media_assets_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "media_assets_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
        ]
      }
      member_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          member_payment_id: string
          membership_charge_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          member_payment_id: string
          membership_charge_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          member_payment_id?: string
          membership_charge_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_payment_allocations_member_payment_id_fkey"
            columns: ["member_payment_id"]
            isOneToOne: false
            referencedRelation: "member_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payment_allocations_membership_charge_id_fkey"
            columns: ["membership_charge_id"]
            isOneToOne: false
            referencedRelation: "membership_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      member_payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          currency: string
          external_reference: string | null
          gym_id: string
          gym_member_id: string
          id: string
          notes: string | null
          paid_at: string
          payment_method_id: string
          receipt_number: string | null
          received_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          currency: string
          external_reference?: string | null
          gym_id: string
          gym_member_id: string
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method_id: string
          receipt_number?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          currency?: string
          external_reference?: string | null
          gym_id?: string
          gym_member_id?: string
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method_id?: string
          receipt_number?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "member_payments_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "member_payments_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "member_payments_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "gym_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "member_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      member_subscription_cancellations: {
        Row: {
          cancel_at_period_end: boolean
          effective_at: string | null
          id: string
          member_subscription_id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          reversed_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          effective_at?: string | null
          id?: string
          member_subscription_id: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          reversed_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          effective_at?: string | null
          id?: string
          member_subscription_id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          reversed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_subscription_cancellations_member_subscription_id_fkey"
            columns: ["member_subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_subscription_events: {
        Row: {
          actor_user_id: string | null
          id: number
          member_subscription_id: string
          new_status: Database["public"]["Enums"]["subscription_status"]
          occurred_at: string
          previous_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          reason: string | null
        }
        Insert: {
          actor_user_id?: string | null
          id?: never
          member_subscription_id: string
          new_status: Database["public"]["Enums"]["subscription_status"]
          occurred_at?: string
          previous_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          reason?: string | null
        }
        Update: {
          actor_user_id?: string | null
          id?: never
          member_subscription_id?: string
          new_status?: Database["public"]["Enums"]["subscription_status"]
          occurred_at?: string
          previous_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_subscription_events_member_subscription_id_fkey"
            columns: ["member_subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_subscriptions: {
        Row: {
          auto_renew: boolean
          billing_cycle_months: number
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          gym_member_id: string
          id: string
          membership_plan_id: string
          recurring_amount: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          billing_cycle_months: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          end_date?: string | null
          gym_member_id: string
          id?: string
          membership_plan_id: string
          recurring_amount: number
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          billing_cycle_months?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          gym_member_id?: string
          id?: string
          membership_plan_id?: string
          recurring_amount?: number
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_subscriptions_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "member_subscriptions_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "member_subscriptions_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "gym_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "member_subscriptions_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_charges: {
        Row: {
          amount_due: number
          created_at: string
          currency: string
          due_date: string
          gym_member_id: string
          id: string
          member_subscription_id: string
          notes: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["charge_status"]
          updated_at: string
        }
        Insert: {
          amount_due: number
          created_at?: string
          currency: string
          due_date: string
          gym_member_id: string
          id?: string
          member_subscription_id: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["charge_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          created_at?: string
          currency?: string
          due_date?: string
          gym_member_id?: string
          id?: string
          member_subscription_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["charge_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_charges_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "membership_charges_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "membership_charges_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "gym_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_charges_gym_member_id_fkey"
            columns: ["gym_member_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["gym_member_id"]
          },
          {
            foreignKeyName: "membership_charges_member_subscription_id_fkey"
            columns: ["member_subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plan_benefits: {
        Row: {
          benefit_code: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          description: string
          id: string
          membership_plan_id: string
          quantity_limit: number | null
        }
        Insert: {
          benefit_code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description: string
          id?: string
          membership_plan_id: string
          quantity_limit?: number | null
        }
        Update: {
          benefit_code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string
          id?: string
          membership_plan_id?: string
          quantity_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_plan_benefits_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          access_limit_per_day: number | null
          billing_cycle_months: number
          code: string
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          description: string | null
          duration_months: number | null
          grace_days: number
          gym_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          access_limit_per_day?: number | null
          billing_cycle_months?: number
          code: string
          created_at?: string
          currency: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          duration_months?: number | null
          grace_days?: number
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          access_limit_per_day?: number | null
          billing_cycle_months?: number
          code?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          duration_months?: number | null
          grace_days?: number
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      other_income_entries: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          currency: string
          description: string | null
          gym_id: string
          id: string
          income_category_id: string
          occurred_at: string
          recorded_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["income_entry_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          currency: string
          description?: string | null
          gym_id: string
          id?: string
          income_category_id: string
          occurred_at?: string
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["income_entry_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          gym_id?: string
          id?: string
          income_category_id?: string
          occurred_at?: string
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["income_entry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_income_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_income_entries_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_income_entries_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "other_income_entries_income_category_id_fkey"
            columns: ["income_category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          id: string
          is_active: boolean
          is_cash: boolean
          name: string
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          is_cash?: boolean
          name: string
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          is_cash?: boolean
          name?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      person_addresses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          address_type: Database["public"]["Enums"]["address_type"]
          city: string | null
          country_code: string | null
          created_at: string
          department_state: string | null
          district: string | null
          id: string
          is_primary: boolean
          person_id: string
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          address_type?: Database["public"]["Enums"]["address_type"]
          city?: string | null
          country_code?: string | null
          created_at?: string
          department_state?: string | null
          district?: string | null
          id?: string
          is_primary?: boolean
          person_id: string
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          address_type?: Database["public"]["Enums"]["address_type"]
          city?: string | null
          country_code?: string | null
          created_at?: string
          department_state?: string | null
          district?: string | null
          id?: string
          is_primary?: boolean
          person_id?: string
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_addresses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "person_addresses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "person_addresses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_addresses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
        ]
      }
      person_contacts: {
        Row: {
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at: string
          id: string
          is_primary: boolean
          person_id: string
          value: string
          verified_at: string | null
        }
        Insert: {
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          id?: string
          is_primary?: boolean
          person_id: string
          value: string
          verified_at?: string | null
        }
        Update: {
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          id?: string
          is_primary?: boolean
          person_id?: string
          value?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "person_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "person_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
        ]
      }
      person_photos: {
        Row: {
          captured_at: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          expires_at: string | null
          gym_id: string
          id: string
          is_primary: boolean
          media_asset_id: string
          person_id: string
          purpose: Database["public"]["Enums"]["photo_purpose"]
        }
        Insert: {
          captured_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          expires_at?: string | null
          gym_id: string
          id?: string
          is_primary?: boolean
          media_asset_id: string
          person_id: string
          purpose: Database["public"]["Enums"]["photo_purpose"]
        }
        Update: {
          captured_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          expires_at?: string | null
          gym_id?: string
          id?: string
          is_primary?: boolean
          media_asset_id?: string
          person_id?: string
          purpose?: Database["public"]["Enums"]["photo_purpose"]
        }
        Relationships: [
          {
            foreignKeyName: "person_photos_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_photos_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "person_photos_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_photos_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "person_photos_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "person_photos_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_photos_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
        ]
      }
      persons: {
        Row: {
          birth_date: string | null
          created_at: string
          created_by: string | null
          first_name: string
          id: string
          last_name: string
          middle_name: string | null
          notes: string | null
          second_last_name: string | null
          sex: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          first_name: string
          id?: string
          last_name?: string
          middle_name?: string | null
          notes?: string | null
          second_last_name?: string | null
          sex?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          first_name?: string
          id?: string
          last_name?: string
          middle_name?: string | null
          notes?: string | null
          second_last_name?: string | null
          sex?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          description: string | null
          gym_id: string
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          gym_id: string
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          gym_id?: string
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      saas_features: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      saas_invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          line_subtotal: number | null
          quantity: number
          saas_invoice_id: string
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_subtotal?: number | null
          quantity?: number
          saas_invoice_id: string
          tax_rate?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_subtotal?: number | null
          quantity?: number
          saas_invoice_id?: string
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "saas_invoice_items_saas_invoice_id_fkey"
            columns: ["saas_invoice_id"]
            isOneToOne: false
            referencedRelation: "saas_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_invoices: {
        Row: {
          amount_paid: number
          created_at: string
          currency: string
          due_at: string | null
          gym_id: string
          gym_saas_subscription_id: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          currency: string
          due_at?: string | null
          gym_id: string
          gym_saas_subscription_id?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          currency?: string
          due_at?: string | null
          gym_id?: string
          gym_saas_subscription_id?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_invoices_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_invoices_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "saas_invoices_gym_saas_subscription_id_fkey"
            columns: ["gym_saas_subscription_id"]
            isOneToOne: false
            referencedRelation: "gym_saas_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          saas_invoice_id: string
          saas_payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          saas_invoice_id: string
          saas_payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          saas_invoice_id?: string
          saas_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_payment_allocations_saas_invoice_id_fkey"
            columns: ["saas_invoice_id"]
            isOneToOne: false
            referencedRelation: "saas_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_payment_allocations_saas_payment_id_fkey"
            columns: ["saas_payment_id"]
            isOneToOne: false
            referencedRelation: "saas_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          failure_reason: string | null
          gym_id: string
          id: string
          paid_at: string | null
          provider: string | null
          provider_transaction_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          failure_reason?: string | null
          gym_id: string
          id?: string
          paid_at?: string | null
          provider?: string | null
          provider_transaction_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gym_id?: string
          id?: string
          paid_at?: string | null
          provider?: string | null
          provider_transaction_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
      saas_plan_features: {
        Row: {
          configuration: Json
          enabled: boolean
          feature_id: string
          limit_value: number | null
          saas_plan_id: string
        }
        Insert: {
          configuration?: Json
          enabled?: boolean
          feature_id: string
          limit_value?: number | null
          saas_plan_id: string
        }
        Update: {
          configuration?: Json
          enabled?: boolean
          feature_id?: string
          limit_value?: number | null
          saas_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "saas_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_plan_features_saas_plan_id_fkey"
            columns: ["saas_plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_plans: {
        Row: {
          billing_interval_months: number
          code: string
          created_at: string
          currency: string
          description: string | null
          id: string
          included_storage_bytes: number | null
          is_active: boolean
          max_branches: number | null
          max_members: number | null
          max_staff_users: number | null
          name: string
          price: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_interval_months?: number
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          included_storage_bytes?: number | null
          is_active?: boolean
          max_branches?: number | null
          max_members?: number | null
          max_staff_users?: number | null
          name: string
          price: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_interval_months?: number
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          included_storage_bytes?: number | null
          is_active?: boolean
          max_branches?: number | null
          max_members?: number | null
          max_staff_users?: number | null
          name?: string
          price?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      saas_subscription_cancellations: {
        Row: {
          cancel_at_period_end: boolean
          effective_at: string | null
          gym_saas_subscription_id: string
          id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          reversed_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          effective_at?: string | null
          gym_saas_subscription_id: string
          id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          reversed_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          effective_at?: string | null
          gym_saas_subscription_id?: string
          id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          reversed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_subscription_cancellations_gym_saas_subscription_id_fkey"
            columns: ["gym_saas_subscription_id"]
            isOneToOne: false
            referencedRelation: "gym_saas_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_permissions: {
        Row: {
          permission_id: string
          screen_id: string
        }
        Insert: {
          permission_id: string
          screen_id: string
        }
        Update: {
          permission_id?: string
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_permissions_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screens: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_screen_id: string | null
          route: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_screen_id?: string | null
          route: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_screen_id?: string | null
          route?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "screens_parent_screen_id_fkey"
            columns: ["parent_screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_deletion_queue: {
        Row: {
          attempts: number
          available_at: string
          bucket_name: string
          created_at: string
          gym_id: string
          id: string
          last_error: string | null
          locked_at: string | null
          media_asset_id: string
          object_path: string
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          bucket_name: string
          created_at?: string
          gym_id: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          media_asset_id: string
          object_path: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          bucket_name?: string
          created_at?: string
          gym_id?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          media_asset_id?: string
          object_path?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_deletion_queue_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_deletion_queue_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "storage_deletion_queue_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          auth_user_id: string
          created_at: string
          last_login_at: string | null
          person_id: string
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          last_login_at?: string | null
          person_id: string
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          last_login_at?: string | null
          person_id?: string
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "api_v1_member_details"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "user_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "api_v1_member_summaries"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "user_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "v_member_access_status"
            referencedColumns: ["person_id"]
          },
        ]
      }
    }
    Views: {
      api_v1_member_details: {
        Row: {
          birth_date: string | null
          branch_id: string | null
          branch_name: string | null
          contacts: Json | null
          created_at: string | null
          current_subscription: Json | null
          first_name: string | null
          full_name: string | null
          gym_id: string | null
          gym_member_id: string | null
          has_overdue_charges: boolean | null
          last_name: string | null
          member_code: string | null
          membership_plan_name: string | null
          membership_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          middle_name: string | null
          next_payment_date: string | null
          notes: string | null
          overdue_amount: number | null
          payment_summary: Json | null
          pending_charges: Json | null
          person_id: string | null
          primary_address: Json | null
          primary_photo_media_asset_id: string | null
          second_last_name: string | null
          sex: string | null
          status: Database["public"]["Enums"]["member_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "gym_members_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_photos_media_asset_id_fkey"
            columns: ["primary_photo_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      api_v1_member_summaries: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          gym_id: string | null
          gym_member_id: string | null
          has_overdue_charges: boolean | null
          last_name: string | null
          member_code: string | null
          membership_plan_name: string | null
          membership_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          next_payment_date: string | null
          overdue_amount: number | null
          person_id: string | null
          primary_photo_media_asset_id: string | null
          status: Database["public"]["Enums"]["member_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
          {
            foreignKeyName: "gym_members_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "gym_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_photos_media_asset_id_fkey"
            columns: ["primary_photo_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      v_gym_dashboard: {
        Row: {
          active_members: number | null
          current_month_income: number | null
          gym_id: string | null
          open_alerts: number | null
          overdue_charges: number | null
          successful_accesses_today: number | null
          trade_name: string | null
        }
        Insert: {
          active_members?: never
          current_month_income?: never
          gym_id?: string | null
          open_alerts?: never
          overdue_charges?: never
          successful_accesses_today?: never
          trade_name?: string | null
        }
        Update: {
          active_members?: never
          current_month_income?: never
          gym_id?: string | null
          open_alerts?: never
          overdue_charges?: never
          successful_accesses_today?: never
          trade_name?: string | null
        }
        Relationships: []
      }
      v_gym_income: {
        Row: {
          amount: number | null
          branch_id: string | null
          currency: string | null
          gym_id: string | null
          occurred_at: string | null
          reference: string | null
          source_id: string | null
          source_type: string | null
        }
        Relationships: []
      }
      v_gym_income_daily: {
        Row: {
          currency: string | null
          gym_id: string | null
          income_date: string | null
          total_income: number | null
        }
        Relationships: []
      }
      v_member_access_status: {
        Row: {
          access_allowed: boolean | null
          first_name: string | null
          gym_id: string | null
          gym_member_id: string | null
          has_active_subscription: boolean | null
          has_overdue_charges: boolean | null
          last_name: string | null
          member_code: string | null
          member_status: Database["public"]["Enums"]["member_status"] | null
          person_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "v_gym_dashboard"
            referencedColumns: ["gym_id"]
          },
        ]
      }
    }
    Functions: {
      archive_gym: {
        Args: { p_gym_id: string; p_reason: string }
        Returns: Json
      }
      cancel_member_subscription: {
        Args: {
          p_cancel_at_period_end?: boolean
          p_member_subscription_id: string
          p_reason?: string
        }
        Returns: {
          auto_renew: boolean
          billing_cycle_months: number
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          gym_member_id: string
          id: string
          membership_plan_id: string
          recurring_amount: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "member_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_storage_deletion_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          available_at: string
          bucket_name: string
          created_at: string
          gym_id: string
          id: string
          last_error: string | null
          locked_at: string | null
          media_asset_id: string
          object_path: string
          processed_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "storage_deletion_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_storage_deletion_job: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      create_gym_member: {
        Args: {
          p_branch_id?: string
          p_create_initial_charge?: boolean
          p_email?: string
          p_first_name: string
          p_gym_id: string
          p_joined_on?: string
          p_last_name: string
          p_member_code?: string
          p_membership_plan_id?: string
          p_payment_amount?: number
          p_payment_currency?: string
          p_payment_method_id?: string
          p_payment_notes?: string
          p_payment_paid_at?: string
          p_phone?: string
          p_subscription_start_date?: string
        }
        Returns: string
      }
      enroll_member_face: {
        Args: {
          p_consent_version?: string
          p_embedding?: string
          p_gym_id: string
          p_gym_member_id: string
          p_height_pixels?: number
          p_mime_type: string
          p_model_code?: string
          p_object_path: string
          p_quality_score?: number
          p_sha256_hex?: string
          p_size_bytes: number
          p_width_pixels?: number
        }
        Returns: Json
      }
      fail_storage_deletion_job: {
        Args: {
          p_error: string
          p_job_id: string
          p_retry_after_seconds?: number
        }
        Returns: undefined
      }
      generate_membership_charges: {
        Args: { p_gym_id: string; p_through_date?: string }
        Returns: number
      }
      get_platform_dashboard: { Args: never; Returns: Json }
      get_platform_gym_detail: { Args: { p_gym_id: string }; Returns: Json }
      list_deleted_entities: {
        Args: {
          p_entity?: string
          p_gym_id: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          deleted_at: string
          deleted_by: string
          deletion_reason: string
          entity_type: string
          id: string
          label: string
        }[]
      }
      match_face_candidates: {
        Args: {
          p_embedding: string
          p_gym_id: string
          p_limit?: number
          p_similarity_threshold?: number
        }
        Returns: {
          access_allowed: boolean
          face_embedding_id: string
          gym_member_id: string
          person_id: string
          similarity: number
        }[]
      }
      request_saas_subscription_cancellation: {
        Args: {
          p_cancel_at_period_end?: boolean
          p_gym_saas_subscription_id: string
          p_reason?: string
        }
        Returns: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          ended_at: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          gym_id: string
          id: string
          saas_plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gym_saas_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_entity: {
        Args: { p_entity: string; p_id: string }
        Returns: Json
      }
      restore_gym: { Args: { p_gym_id: string }; Returns: Json }
      soft_delete_entity: {
        Args: { p_entity: string; p_id: string; p_reason?: string }
        Returns: Json
      }
      update_gym_member: {
        Args: {
          p_branch_id?: string
          p_email?: string
          p_first_name?: string
          p_gym_id: string
          p_gym_member_id: string
          p_last_name?: string
          p_member_code?: string
          p_phone?: string
          p_status?: Database["public"]["Enums"]["member_status"]
        }
        Returns: {
          branch_id: string | null
          branch_name: string | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          gym_id: string | null
          gym_member_id: string | null
          has_overdue_charges: boolean | null
          last_name: string | null
          member_code: string | null
          membership_plan_name: string | null
          membership_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          next_payment_date: string | null
          overdue_amount: number | null
          person_id: string | null
          primary_photo_media_asset_id: string | null
          status: Database["public"]["Enums"]["member_status"] | null
        }
        SetofOptions: {
          from: "*"
          to: "api_v1_member_summaries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_face_access: {
        Args: {
          p_branch_id?: string
          p_device_id?: string
          p_embedding: string
          p_gym_id: string
          p_model_code?: string
          p_processing_ms?: number
          p_similarity_threshold?: number
        }
        Returns: Json
      }
    }
    Enums: {
      access_decision: "allowed" | "denied" | "manual_review" | "no_match"
      address_type: "home" | "work" | "billing" | "other"
      alert_severity: "info" | "warning" | "critical"
      alert_status: "open" | "acknowledged" | "resolved" | "dismissed"
      biometric_consent_status: "granted" | "revoked" | "expired"
      charge_status: "pending" | "partial" | "paid" | "overdue" | "void"
      contact_type: "email" | "phone" | "whatsapp" | "other"
      income_entry_status: "draft" | "posted" | "void"
      invoice_status:
        | "draft"
        | "open"
        | "partially_paid"
        | "paid"
        | "void"
        | "uncollectible"
      member_status:
        | "prospect"
        | "active"
        | "inactive"
        | "suspended"
        | "blocked"
        | "archived"
      payment_status:
        | "pending"
        | "processing"
        | "settled"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "void"
      photo_purpose:
        | "profile"
        | "face_enrollment"
        | "identity_document"
        | "payment_receipt"
        | "other"
      record_status: "active" | "inactive" | "suspended" | "deleted"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "paused"
        | "canceled"
        | "expired"
      user_membership_status: "invited" | "active" | "suspended" | "revoked"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_decision: ["allowed", "denied", "manual_review", "no_match"],
      address_type: ["home", "work", "billing", "other"],
      alert_severity: ["info", "warning", "critical"],
      alert_status: ["open", "acknowledged", "resolved", "dismissed"],
      biometric_consent_status: ["granted", "revoked", "expired"],
      charge_status: ["pending", "partial", "paid", "overdue", "void"],
      contact_type: ["email", "phone", "whatsapp", "other"],
      income_entry_status: ["draft", "posted", "void"],
      invoice_status: [
        "draft",
        "open",
        "partially_paid",
        "paid",
        "void",
        "uncollectible",
      ],
      member_status: [
        "prospect",
        "active",
        "inactive",
        "suspended",
        "blocked",
        "archived",
      ],
      payment_status: [
        "pending",
        "processing",
        "settled",
        "failed",
        "refunded",
        "partially_refunded",
        "void",
      ],
      photo_purpose: [
        "profile",
        "face_enrollment",
        "identity_document",
        "payment_receipt",
        "other",
      ],
      record_status: ["active", "inactive", "suspended", "deleted"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "paused",
        "canceled",
        "expired",
      ],
      user_membership_status: ["invited", "active", "suspended", "revoked"],
    },
  },
} as const

