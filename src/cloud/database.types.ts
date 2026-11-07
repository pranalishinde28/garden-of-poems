
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "blocks": {
                  Row: {
                    "blocked": string,"blocker": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked": string,"blocker"?: string,"created_at"?: string
                  }
                  Update: {
                    "blocked"?: string,"blocker"?: string,"created_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"books": {
                  Row: {
                    "author": string,"body": string,"created_at": string,"id": string,"owner": string,"private": boolean,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author"?: string,"body": string,"created_at"?: string,"id": string,"owner"?: string,"private"?: boolean,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author"?: string,"body"?: string,"created_at"?: string,"id"?: string,"owner"?: string,"private"?: boolean,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"digest_prefs": {
                  Row: {
                    "last_sent": string | null,"token": string,"user_id": string,"weekly": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "last_sent"?: string | null,"token"?: string,"user_id": string,"weekly"?: boolean
                  }
                  Update: {
                    "last_sent"?: string | null,"token"?: string,"user_id"?: string,"weekly"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"garden_shares": {
                  Row: {
                    "created_at": string,"label": string,"last_opened": string | null,"opened": number,"owner": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"label"?: string,"last_opened"?: string | null,"opened"?: number,"owner": string,"token"?: string
                  }
                  Update: {
                    "created_at"?: string,"label"?: string,"last_opened"?: string | null,"opened"?: number,"owner"?: string,"token"?: string
                  }
                  Relationships: [
                    
                  ]
                },"garden_visits": {
                  Row: {
                    "day": string,"garden_owner": string,"visitor": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day"?: string,"garden_owner": string,"visitor": string
                  }
                  Update: {
                    "day"?: string,"garden_owner"?: string,"visitor"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gardens": {
                  Row: {
                    "description": string,"is_public": boolean,"name": string,"owner": string,"settings": NonNullable<Json>,"theme": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"is_public"?: boolean,"name"?: string,"owner": string,"settings"?: NonNullable<Json>,"theme"?: string,"updated_at"?: string
                  }
                  Update: {
                    "description"?: string,"is_public"?: boolean,"name"?: string,"owner"?: string,"settings"?: NonNullable<Json>,"theme"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gardens_owner_fkey"
      columns: ["owner"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderators": {
                  Row: {
                    "user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"note_reports": {
                  Row: {
                    "created_at": string,"id": string,"note_id": string,"reason": string | null,"reporter": string,"reviewed": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"note_id": string,"reason"?: string | null,"reporter"?: string,"reviewed"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"note_id"?: string,"reason"?: string | null,"reporter"?: string,"reviewed"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_reports_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "note_reports_reporter_fkey"
      columns: ["reporter"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "author": string,"created_at": string,"garden_owner": string,"hidden": boolean,"id": string,"poem_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author"?: string,"created_at"?: string,"garden_owner": string,"hidden"?: boolean,"id"?: string,"poem_id": string,"text": string
                  }
                  Update: {
                    "author"?: string,"created_at"?: string,"garden_owner"?: string,"hidden"?: boolean,"id"?: string,"poem_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_author_fkey"
      columns: ["author"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_garden_owner_poem_id_fkey"
      columns: ["garden_owner","poem_id"]
isOneToOne: false
      referencedRelation: "poems"
      referencedColumns: ["owner","id"]
    }
                  ]
                },"paintings": {
                  Row: {
                    "artist": string,"created_at": string,"height": number,"id": string,"note": string,"owner": string,"path": string,"private": boolean,"title": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "artist"?: string,"created_at"?: string,"height"?: number,"id": string,"note"?: string,"owner"?: string,"path": string,"private"?: boolean,"title": string,"width"?: number
                  }
                  Update: {
                    "artist"?: string,"created_at"?: string,"height"?: number,"id"?: string,"note"?: string,"owner"?: string,"path"?: string,"private"?: boolean,"title"?: string,"width"?: number
                  }
                  Relationships: [
                    
                  ]
                },"poem_likes": {
                  Row: {
                    "created_at": string,"garden_owner": string,"liker": string,"poem_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"garden_owner": string,"liker": string,"poem_id": string
                  }
                  Update: {
                    "created_at"?: string,"garden_owner"?: string,"liker"?: string,"poem_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poem_likes_garden_owner_poem_id_fkey"
      columns: ["garden_owner","poem_id"]
isOneToOne: false
      referencedRelation: "poems"
      referencedColumns: ["owner","id"]
    }
                  ]
                },"poems": {
                  Row: {
                    "content": string,"created_at": string,"deleted_at": string | null,"id": string,"important": boolean,"mood": string | null,"owner": string,"plant_type": string | null,"position": Json | null,"private": boolean,"theme": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"deleted_at"?: string | null,"id": string,"important"?: boolean,"mood"?: string | null,"owner": string,"plant_type"?: string | null,"position"?: Json | null,"private"?: boolean,"theme"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"important"?: boolean,"mood"?: string | null,"owner"?: string,"plant_type"?: string | null,"position"?: Json | null,"private"?: boolean,"theme"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poems_owner_fkey"
      columns: ["owner"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar": Json | null,"created_at": string,"display_name": string | null,"id": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar"?: Json | null,"created_at"?: string,"display_name"?: string | null,"id": string,"username"?: string | null
                  }
                  Update: {
                    "avatar"?: Json | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"username"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"tends": {
                  Row: {
                    "created_at": string,"garden_owner": string,"last_seen": string,"tender": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"garden_owner": string,"last_seen"?: string,"tender"?: string
                  }
                  Update: {
                    "created_at"?: string,"garden_owner"?: string,"last_seen"?: string,"tender"?: string
                  }
                  Relationships: [
                    
                  ]
                },"waitlist": {
                  Row: {
                    "created_at": string,"person": string,"wish": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"person": string,"wish": string
                  }
                  Update: {
                    "created_at"?: string,"person"?: string,"wish"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "public_gardens": {
                  Row: {
                    "description": string | null,"display_name": string | null,"name": string | null,"owner": string | null,"poem_count": number | null,"settings": Json | null,"theme": string | null,"updated_at": string | null,"username": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "gardens_owner_fkey"
      columns: ["owner"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "blocked_by":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"change_username":
{ Args: { "new_name": string }; Returns: string
                           },
"create_share":
{ Args: { "p_label"?: string }; Returns: {
              "created_at": string,
"label": string,
"last_opened": string | null,
"opened": number,
"owner": string,
"token": string
            }
                          SetofOptions: {
        from: "*"
        to: "garden_shares"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"digest_batch":
{ Args: { "p_lim"?: number,"p_only"?: string }; Returns: {
              "email": string,"letter": Json,"name": string,"since": string,"token": string,"user_id": string,"username": string
            }[]
                           },
"digest_letter":
{ Args: { "p_since": string,"p_uid": string }; Returns: Json
                           },
"digest_sent":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"digest_unsubscribe":
{ Args: { "p_token": string }; Returns: boolean
                           },
"list_public_gardens":
{ Args: { "after_owner"?: string,"after_updated"?: string,"lim"?: number,"q"?: string }; Returns: {
              "description": string | null,
"display_name": string | null,
"name": string | null,
"owner": string | null,
"poem_count": number | null,
"settings": Json | null,
"theme": string | null,
"updated_at": string | null,
"username": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "public_gardens"
        isOneToOne: false
        isSetofReturn: true
      } },
"my_digest":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_tenders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_visits":
{ Args: Record<PropertyKey, never>; Returns: {
              "month": number,"people": number,"today": number,"total": number,"week": number
            }[]
                           },
"only_keys":
{ Args: { "allowed": (string)[],"obj": Json }; Returns: boolean
                           },
"poem_likes_for":
{ Args: { "p_owner": string }; Returns: {
              "likes": number,"mine": boolean,"poem_id": string
            }[]
                           },
"poem_visible":
{ Args: { "p_id": string,"p_owner": string }; Returns: boolean
                           },
"record_visit":
{ Args: { "p_owner": string,"p_token"?: string,"p_visitor": string }; Returns: undefined
                           },
"remove_poem":
{ Args: { "poem_id": string }; Returns: {
              "content": string,
"created_at": string,
"deleted_at": string | null,
"id": string,
"important": boolean,
"mood": string | null,
"owner": string,
"plant_type": string | null,
"position": Json | null,
"private": boolean,
"theme": string | null,
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "poems"
        isOneToOne: true
        isSetofReturn: false
      } },
"restore_poem":
{ Args: { "poem_id": string }; Returns: {
              "content": string,
"created_at": string,
"deleted_at": string | null,
"id": string,
"important": boolean,
"mood": string | null,
"owner": string,
"plant_type": string | null,
"position": Json | null,
"private": boolean,
"theme": string | null,
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "poems"
        isOneToOne: true
        isSetofReturn: false
      } },
"review_note":
{ Args: { "p_hide": boolean,"p_note": string }; Returns: undefined
                           },
"review_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "author_name": string,"first_reported": string,"hidden": boolean,"note_id": string,"poem_title": string,"poet_name": string,"reasons": (string)[],"reports": number,"text": string
            }[]
                           },
"save_poem":
{ Args: { "base"?: string,"p": Json }; Returns: Json
                           },
"set_digest":
{ Args: { "p_on": boolean }; Returns: boolean
                           },
"shared_garden":
{ Args: { "p_token": string }; Returns: Json
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"suggested_gardens":
{ Args: { "lim"?: number }; Returns: {
              "description": string,"display_name": string,"name": string,"owner": string,"poem_count": number,"reason": string,"settings": Json,"theme": string,"updated_at": string,"username": string
            }[]
                           },
"tended_gardens":
{ Args: Record<PropertyKey, never>; Returns: {
              "description": string,"display_name": string,"fresh": number,"is_public": boolean,"last_seen": string,"name": string,"newest": string,"newest_at": string,"owner": string,"settings": Json,"tended_at": string,"theme": string,"username": string
            }[]
                           },
"tended_seen":
{ Args: { "p_owner": string }; Returns: undefined
                           },
"username_available":
{ Args: { "name": string }; Returns: boolean
                           },
"valid_avatar":
{ Args: { "a": Json }; Returns: boolean
                           },
"valid_settings":
{ Args: { "s": Json }; Returns: boolean
                           },
"whats_new":
{ Args: { "since": string }; Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
