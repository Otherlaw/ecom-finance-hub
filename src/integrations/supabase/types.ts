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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      categorias_financeiras: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      centros_de_custo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_card_invoices: {
        Row: {
          arquivo_importacao_url: string | null
          arquivo_url: string | null
          competencia: string | null
          created_at: string
          created_by: string | null
          credit_card_id: string
          data_fechamento: string
          data_pagamento: string | null
          data_vencimento: string
          id: string
          mes_referencia: string
          observacoes: string | null
          pago: boolean
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          arquivo_importacao_url?: string | null
          arquivo_url?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          credit_card_id: string
          data_fechamento: string
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          mes_referencia: string
          observacoes?: string | null
          pago?: boolean
          status?: string
          updated_at?: string
          valor_total: number
        }
        Update: {
          arquivo_importacao_url?: string | null
          arquivo_url?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          credit_card_id?: string
          data_fechamento?: string
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          pago?: boolean
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_invoices_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_transactions: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          comprovante_url: string | null
          created_at: string
          created_by: string | null
          data_lancamento: string | null
          data_transacao: string
          descricao: string
          estabelecimento: string | null
          id: string
          invoice_id: string
          moeda: string | null
          numero_parcela: string | null
          observacoes: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tipo: Database["public"]["Enums"]["transaction_type"]
          tipo_despesa: string | null
          tipo_movimento: string | null
          total_parcelas: number | null
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data_lancamento?: string | null
          data_transacao: string
          descricao: string
          estabelecimento?: string | null
          id?: string
          invoice_id: string
          moeda?: string | null
          numero_parcela?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tipo?: Database["public"]["Enums"]["transaction_type"]
          tipo_despesa?: string | null
          tipo_movimento?: string | null
          total_parcelas?: number | null
          updated_at?: string
          updated_by?: string | null
          valor: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data_lancamento?: string | null
          data_transacao?: string
          descricao?: string
          estabelecimento?: string | null
          id?: string
          invoice_id?: string
          moeda?: string | null
          numero_parcela?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tipo?: Database["public"]["Enums"]["transaction_type"]
          tipo_despesa?: string | null
          tipo_movimento?: string | null
          total_parcelas?: number | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "credit_card_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          ativo: boolean
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          empresa_id: string
          id: string
          instituicao_financeira: string
          limite_credito: number | null
          nome: string
          observacoes: string | null
          responsavel_id: string | null
          tipo: Database["public"]["Enums"]["card_type"]
          ultimos_digitos: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_fechamento: number
          dia_vencimento: number
          empresa_id: string
          id?: string
          instituicao_financeira: string
          limite_credito?: number | null
          nome: string
          observacoes?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["card_type"]
          ultimos_digitos?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          empresa_id?: string
          id?: string
          instituicao_financeira?: string
          limite_credito?: number | null
          nome?: string
          observacoes?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["card_type"]
          ultimos_digitos?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          razao_social: string
          regime_tributario: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          razao_social: string
          regime_tributario: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          regime_tributario?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      responsaveis: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          funcao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          funcao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          funcao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      card_type: "credito" | "debito"
      transaction_status: "conciliado" | "pendente" | "aprovado" | "reprovado"
      transaction_type: "recorrente" | "pontual"
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
      card_type: ["credito", "debito"],
      transaction_status: ["conciliado", "pendente", "aprovado", "reprovado"],
      transaction_type: ["recorrente", "pontual"],
    },
  },
} as const
