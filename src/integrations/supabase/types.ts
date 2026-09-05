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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      box_certificate_secrets: {
        Row: {
          box_id: string
          created_at: string
          password_ciphertext: string
          password_iv: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          box_id: string
          created_at?: string
          password_ciphertext: string
          password_iv: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          box_id?: string
          created_at?: string
          password_ciphertext?: string
          password_iv?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_certificate_secrets_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: true
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      box_certificates: {
        Row: {
          box_id: string
          created_at: string
          file_name: string
          holder_name: string
          holder_tax_id: string
          id: string
          issuer: string
          not_after: string | null
          not_before: string | null
          status: Database["public"]["Enums"]["cert_status"]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          box_id: string
          created_at?: string
          file_name?: string
          holder_name?: string
          holder_tax_id?: string
          id?: string
          issuer?: string
          not_after?: string | null
          not_before?: string | null
          status: Database["public"]["Enums"]["cert_status"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          box_id?: string
          created_at?: string
          file_name?: string
          holder_name?: string
          holder_tax_id?: string
          id?: string
          issuer?: string
          not_after?: string | null
          not_before?: string | null
          status?: Database["public"]["Enums"]["cert_status"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "box_certificates_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: true
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      box_review_messages: {
        Row: {
          box_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          box_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          box_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_review_messages_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxes: {
        Row: {
          address: string
          city: string
          cover_url: string | null
          created_at: string
          description: string
          id: string
          logistics: string[]
          logo_url: string | null
          main_category: Database["public"]["Enums"]["product_category"] | null
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["box_plan"]
          rating_avg: number | null
          rating_count: number
          region: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          state: string
          state_registration: string
          status: Database["public"]["Enums"]["box_status"]
          story: string
          tax_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string
          city: string
          cover_url?: string | null
          created_at?: string
          description?: string
          id?: string
          logistics?: string[]
          logo_url?: string | null
          main_category?: Database["public"]["Enums"]["product_category"] | null
          name: string
          owner_id: string
          plan?: Database["public"]["Enums"]["box_plan"]
          rating_avg?: number | null
          rating_count?: number
          region?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          state?: string
          state_registration?: string
          status?: Database["public"]["Enums"]["box_status"]
          story?: string
          tax_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string
          city?: string
          cover_url?: string | null
          created_at?: string
          description?: string
          id?: string
          logistics?: string[]
          logo_url?: string | null
          main_category?: Database["public"]["Enums"]["product_category"] | null
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["box_plan"]
          rating_avg?: number | null
          rating_count?: number
          region?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          state?: string
          state_registration?: string
          status?: Database["public"]["Enums"]["box_status"]
          story?: string
          tax_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          box_id: string | null
          created_at: string
          id: string
          product_id: string | null
          user_id: string
        }
        Insert: {
          box_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          user_id: string
        }
        Update: {
          box_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          api_secret: string
          api_token: string
          created_at: string
          environment: string
          id: number
          notes: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_secret?: string
          api_token?: string
          created_at?: string
          environment?: string
          id?: number
          notes?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_secret?: string
          api_token?: string
          created_at?: string
          environment?: string
          id?: number
          notes?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          access_key: string
          box_id: string
          cfop: string
          created_at: string
          danfe_path: string
          id: string
          issued_at: string | null
          number: string
          order_id: string
          payload: Json
          rejection_reason: string
          series: string
          status: Database["public"]["Enums"]["nfe_status"]
          updated_at: string
          xml_path: string
        }
        Insert: {
          access_key?: string
          box_id: string
          cfop?: string
          created_at?: string
          danfe_path?: string
          id?: string
          issued_at?: string | null
          number?: string
          order_id: string
          payload?: Json
          rejection_reason?: string
          series?: string
          status?: Database["public"]["Enums"]["nfe_status"]
          updated_at?: string
          xml_path?: string
        }
        Update: {
          access_key?: string
          box_id?: string
          cfop?: string
          created_at?: string
          danfe_path?: string
          id?: string
          issued_at?: string | null
          number?: string
          order_id?: string
          payload?: Json
          rejection_reason?: string
          series?: string
          status?: Database["public"]["Enums"]["nfe_status"]
          updated_at?: string
          xml_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          image_url: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          image_url?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          box_id: string
          buyer_fiscal: Json
          buyer_id: string
          commission_amount: number
          commission_rate: number
          completed_at: string | null
          created_at: string
          delivered_at: string | null
          dispute_reason: string
          disputed_at: string | null
          id: string
          net_amount: number
          notes: string
          paid_at: string | null
          payment_proof_url: string | null
          resolution_note: string
          shipped_at: string | null
          shipping_note: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          tracking_code: string
          updated_at: string
        }
        Insert: {
          box_id: string
          buyer_fiscal?: Json
          buyer_id: string
          commission_amount?: number
          commission_rate?: number
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          dispute_reason?: string
          disputed_at?: string | null
          id?: string
          net_amount?: number
          notes?: string
          paid_at?: string | null
          payment_proof_url?: string | null
          resolution_note?: string
          shipped_at?: string | null
          shipping_note?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          tracking_code?: string
          updated_at?: string
        }
        Update: {
          box_id?: string
          buyer_fiscal?: Json
          buyer_id?: string
          commission_amount?: number
          commission_rate?: number
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          dispute_reason?: string
          disputed_at?: string | null
          id?: string
          net_amount?: number
          notes?: string
          paid_at?: string | null
          payment_proof_url?: string | null
          resolution_note?: string
          shipped_at?: string | null
          shipping_note?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          tracking_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          box_id: string
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string
          id: string
          images: string[]
          name: string
          ncm: string
          price: number
          rating_avg: number | null
          rating_count: number
          stock: number
          subcategory: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          box_id: string
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name: string
          ncm?: string
          price: number
          rating_avg?: number | null
          rating_count?: number
          stock?: number
          subcategory: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          box_id?: string
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name?: string
          ncm?: string
          price?: number
          rating_avg?: number | null
          rating_count?: number
          stock?: number
          subcategory?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          avatar_url: string | null
          cep: string
          city: string | null
          created_at: string
          full_name: string
          id: string
          legal_name: string
          phone: string | null
          state: string | null
          state_registration: string
          tax_id: string
          updated_at: string
        }
        Insert: {
          address?: string
          avatar_url?: string | null
          cep?: string
          city?: string | null
          created_at?: string
          full_name?: string
          id: string
          legal_name?: string
          phone?: string | null
          state?: string | null
          state_registration?: string
          tax_id?: string
          updated_at?: string
        }
        Update: {
          address?: string
          avatar_url?: string | null
          cep?: string
          city?: string | null
          created_at?: string
          full_name?: string
          id?: string
          legal_name?: string
          phone?: string | null
          state?: string | null
          state_registration?: string
          tax_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          box_id: string
          buyer_id: string
          comment: string
          created_at: string
          id: string
          order_id: string
          product_rating: number
          rating: number
          report_reason: string
          reported: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          box_id: string
          buyer_id: string
          comment?: string
          created_at?: string
          id?: string
          order_id: string
          product_rating: number
          rating: number
          report_reason?: string
          reported?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          box_id?: string
          buyer_id?: string
          comment?: string
          created_at?: string
          id?: string
          order_id?: string
          product_rating?: number
          rating?: number
          report_reason?: string
          reported?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_order: { Args: { _order_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_certificate: { Args: { _box_id: string }; Returns: boolean }
      is_box_approved: { Args: { _box_id: string }; Returns: boolean }
      is_box_owner: { Args: { _box_id: string }; Returns: boolean }
      is_valid_cnpj: { Args: { _v: string }; Returns: boolean }
      is_valid_cpf: { Args: { _v: string }; Returns: boolean }
      is_valid_ie: { Args: { _uf: string; _v: string }; Returns: boolean }
      place_order: {
        Args: {
          _box_id: string
          _buyer_fiscal?: Json
          _items: Json
          _notes: string
        }
        Returns: string
      }
      plan_commission_rate: {
        Args: { _plan: Database["public"]["Enums"]["box_plan"] }
        Returns: number
      }
      plan_product_limit: {
        Args: { _plan: Database["public"]["Enums"]["box_plan"] }
        Returns: number
      }
      recompute_ratings: {
        Args: { _box_id: string; _order_id: string }
        Returns: undefined
      }
      release_due_orders: { Args: never; Returns: number }
      report_review: {
        Args: { _reason: string; _review_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "buyer"
      box_plan: "basico" | "intermediario" | "premium"
      box_status: "pendente" | "aprovado" | "rejeitado" | "suspenso"
      cert_status: "valido" | "expirado" | "senha_incorreta" | "invalido"
      nfe_status:
        | "pendente_emissao"
        | "processando_sefaz"
        | "autorizada"
        | "rejeitada"
        | "cancelada"
      order_status:
        | "pendente_pagamento"
        | "pago_em_custodia"
        | "enviado"
        | "aguardando_confirmacao"
        | "concluido_liquidado"
        | "em_disputa"
        | "cancelado"
      product_category: "plantas" | "insumos" | "maquinas"
      review_status: "aprovada" | "oculta"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "seller", "buyer"],
      box_plan: ["basico", "intermediario", "premium"],
      box_status: ["pendente", "aprovado", "rejeitado", "suspenso"],
      cert_status: ["valido", "expirado", "senha_incorreta", "invalido"],
      nfe_status: [
        "pendente_emissao",
        "processando_sefaz",
        "autorizada",
        "rejeitada",
        "cancelada",
      ],
      order_status: [
        "pendente_pagamento",
        "pago_em_custodia",
        "enviado",
        "aguardando_confirmacao",
        "concluido_liquidado",
        "em_disputa",
        "cancelado",
      ],
      product_category: ["plantas", "insumos", "maquinas"],
      review_status: ["aprovada", "oculta"],
    },
  },
} as const
