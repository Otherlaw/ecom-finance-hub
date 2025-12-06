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
      bank_transactions: {
        Row: {
          atualizado_em: string
          categoria_id: string | null
          centro_custo_id: string | null
          conta_id: string | null
          criado_em: string
          data_competencia: string | null
          data_transacao: string
          descricao: string
          documento: string | null
          empresa_id: string
          id: string
          origem_extrato: string
          referencia_externa: string | null
          responsavel_id: string | null
          status: string
          tipo_lancamento: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_id?: string | null
          criado_em?: string
          data_competencia?: string | null
          data_transacao: string
          descricao: string
          documento?: string | null
          empresa_id: string
          id?: string
          origem_extrato: string
          referencia_externa?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_lancamento: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_id?: string | null
          criado_em?: string
          data_competencia?: string | null
          data_transacao?: string
          descricao?: string
          documento?: string | null
          empresa_id?: string
          id?: string
          origem_extrato?: string
          referencia_externa?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_lancamento?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
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
          codigo: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_de_custo_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_registros: {
        Row: {
          canal: string | null
          created_at: string
          custo_total: number
          custo_unitario_momento: number
          data: string
          empresa_id: string
          id: string
          margem_bruta: number | null
          margem_percentual: number | null
          observacoes: string | null
          origem: string
          preco_venda_unitario: number | null
          produto_id: string
          quantidade: number
          receita_total: number | null
          referencia_id: string | null
          sku_id: string | null
        }
        Insert: {
          canal?: string | null
          created_at?: string
          custo_total: number
          custo_unitario_momento: number
          data: string
          empresa_id: string
          id?: string
          margem_bruta?: number | null
          margem_percentual?: number | null
          observacoes?: string | null
          origem: string
          preco_venda_unitario?: number | null
          produto_id: string
          quantidade: number
          receita_total?: number | null
          referencia_id?: string | null
          sku_id?: string | null
        }
        Update: {
          canal?: string | null
          created_at?: string
          custo_total?: number
          custo_unitario_momento?: number
          data?: string
          empresa_id?: string
          id?: string
          margem_bruta?: number | null
          margem_percentual?: number | null
          observacoes?: string | null
          origem?: string
          preco_venda_unitario?: number | null
          produto_id?: string
          quantidade?: number
          receita_total?: number | null
          referencia_id?: string | null
          sku_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cmv_registros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_registros_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_registros_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "produto_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          chave_acesso: string | null
          created_at: string
          data_compra: string
          empresa_id: string
          fornecedor_cnpj: string | null
          fornecedor_nome: string
          id: string
          numero_nf: string | null
          observacoes: string | null
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          chave_acesso?: string | null
          created_at?: string
          data_compra: string
          empresa_id: string
          fornecedor_cnpj?: string | null
          fornecedor_nome: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          chave_acesso?: string | null
          created_at?: string
          data_compra?: string
          empresa_id?: string
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_itens: {
        Row: {
          aliquota_icms: number | null
          cfop: string | null
          codigo_produto_nf: string | null
          compra_id: string
          created_at: string
          descricao_nf: string
          id: string
          mapeado: boolean
          ncm: string | null
          produto_id: string | null
          quantidade: number
          quantidade_recebida: number
          sku_id: string | null
          updated_at: string
          valor_icms: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota_icms?: number | null
          cfop?: string | null
          codigo_produto_nf?: string | null
          compra_id: string
          created_at?: string
          descricao_nf: string
          id?: string
          mapeado?: boolean
          ncm?: string | null
          produto_id?: string | null
          quantidade?: number
          quantidade_recebida?: number
          sku_id?: string | null
          updated_at?: string
          valor_icms?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          aliquota_icms?: number | null
          cfop?: string | null
          codigo_produto_nf?: string | null
          compra_id?: string
          created_at?: string
          descricao_nf?: string
          id?: string
          mapeado?: boolean
          ncm?: string | null
          produto_id?: string | null
          quantidade?: number
          quantidade_recebida?: number
          sku_id?: string | null
          updated_at?: string
          valor_icms?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_itens_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "produto_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_a_pagar: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          conciliado: boolean
          created_at: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          documento: string | null
          empresa_id: string
          forma_pagamento: string | null
          fornecedor_nome: string
          id: string
          observacoes: string | null
          recorrente: boolean
          status: string
          tipo_lancamento: string
          updated_at: string
          valor_em_aberto: number
          valor_pago: number
          valor_total: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          conciliado?: boolean
          created_at?: string
          data_emissao: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          documento?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          fornecedor_nome: string
          id?: string
          observacoes?: string | null
          recorrente?: boolean
          status?: string
          tipo_lancamento?: string
          updated_at?: string
          valor_em_aberto: number
          valor_pago?: number
          valor_total: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          conciliado?: boolean
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          documento?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          fornecedor_nome?: string
          id?: string
          observacoes?: string | null
          recorrente?: boolean
          status?: string
          tipo_lancamento?: string
          updated_at?: string
          valor_em_aberto?: number
          valor_pago?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_a_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_a_receber: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          cliente_nome: string
          conciliado: boolean
          created_at: string
          data_emissao: string
          data_recebimento: string | null
          data_vencimento: string
          descricao: string
          documento: string | null
          empresa_id: string
          forma_recebimento: string | null
          id: string
          observacoes: string | null
          origem: string | null
          recorrente: boolean
          status: string
          tipo_lancamento: string
          updated_at: string
          valor_em_aberto: number
          valor_recebido: number
          valor_total: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_nome: string
          conciliado?: boolean
          created_at?: string
          data_emissao: string
          data_recebimento?: string | null
          data_vencimento: string
          descricao: string
          documento?: string | null
          empresa_id: string
          forma_recebimento?: string | null
          id?: string
          observacoes?: string | null
          origem?: string | null
          recorrente?: boolean
          status?: string
          tipo_lancamento?: string
          updated_at?: string
          valor_em_aberto: number
          valor_recebido?: number
          valor_total: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_nome?: string
          conciliado?: boolean
          created_at?: string
          data_emissao?: string
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string
          documento?: string | null
          empresa_id?: string
          forma_recebimento?: string | null
          id?: string
          observacoes?: string | null
          origem?: string | null
          recorrente?: boolean
          status?: string
          tipo_lancamento?: string
          updated_at?: string
          valor_em_aberto?: number
          valor_recebido?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_a_receber_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_receber_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_receber_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "credit_cards_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
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
      manual_transactions: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          created_at: string
          data: string
          descricao: string
          empresa_id: string
          id: string
          observacoes: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data: string
          descricao: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "manual_transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_transactions_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_transactions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_transactions_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_import_jobs: {
        Row: {
          arquivo_nome: string
          atualizado_em: string
          canal: string
          criado_em: string
          empresa_id: string
          finalizado_em: string | null
          id: string
          linhas_com_erro: number
          linhas_duplicadas: number
          linhas_importadas: number
          linhas_processadas: number
          mensagem_erro: string | null
          status: string
          total_linhas: number
        }
        Insert: {
          arquivo_nome: string
          atualizado_em?: string
          canal: string
          criado_em?: string
          empresa_id: string
          finalizado_em?: string | null
          id?: string
          linhas_com_erro?: number
          linhas_duplicadas?: number
          linhas_importadas?: number
          linhas_processadas?: number
          mensagem_erro?: string | null
          status?: string
          total_linhas?: number
        }
        Update: {
          arquivo_nome?: string
          atualizado_em?: string
          canal?: string
          criado_em?: string
          empresa_id?: string
          finalizado_em?: string | null
          id?: string
          linhas_com_erro?: number
          linhas_duplicadas?: number
          linhas_importadas?: number
          linhas_processadas?: number
          mensagem_erro?: string | null
          status?: string
          total_linhas?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_import_jobs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_rules: {
        Row: {
          ativo: boolean
          canal: string
          categoria_id: string | null
          centro_custo_id: string | null
          created_at: string
          empresa_id: string
          id: string
          prioridade: number
          texto_contem: string
          tipo_lancamento: string
          tipo_transacao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          prioridade?: number
          texto_contem: string
          tipo_lancamento: string
          tipo_transacao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          prioridade?: number
          texto_contem?: string
          tipo_lancamento?: string
          tipo_transacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_rules_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_rules_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_rules_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sku_mappings: {
        Row: {
          canal: string
          created_at: string | null
          empresa_id: string
          id: string
          mapeado_automaticamente: boolean | null
          nome_produto_marketplace: string | null
          produto_id: string | null
          sku_id: string | null
          sku_marketplace: string
          updated_at: string | null
        }
        Insert: {
          canal: string
          created_at?: string | null
          empresa_id: string
          id?: string
          mapeado_automaticamente?: boolean | null
          nome_produto_marketplace?: string | null
          produto_id?: string | null
          sku_id?: string | null
          sku_marketplace: string
          updated_at?: string | null
        }
        Update: {
          canal?: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          mapeado_automaticamente?: boolean | null
          nome_produto_marketplace?: string | null
          produto_id?: string | null
          sku_id?: string | null
          sku_marketplace?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sku_mappings_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_sku_mappings_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_sku_mappings_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "produto_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_transaction_items: {
        Row: {
          anuncio_id: string | null
          created_at: string
          descricao_item: string | null
          id: string
          preco_total: number | null
          preco_unitario: number | null
          produto_id: string | null
          quantidade: number
          sku_id: string | null
          sku_marketplace: string | null
          transaction_id: string
          updated_at: string
          variante_id: string | null
        }
        Insert: {
          anuncio_id?: string | null
          created_at?: string
          descricao_item?: string | null
          id?: string
          preco_total?: number | null
          preco_unitario?: number | null
          produto_id?: string | null
          quantidade?: number
          sku_id?: string | null
          sku_marketplace?: string | null
          transaction_id: string
          updated_at?: string
          variante_id?: string | null
        }
        Update: {
          anuncio_id?: string | null
          created_at?: string
          descricao_item?: string | null
          id?: string
          preco_total?: number | null
          preco_unitario?: number | null
          produto_id?: string | null
          quantidade?: number
          sku_id?: string | null
          sku_marketplace?: string | null
          transaction_id?: string
          updated_at?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_transaction_items_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transaction_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "produto_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "marketplace_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_transactions: {
        Row: {
          atualizado_em: string
          canal: string
          canal_venda: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          conta_nome: string | null
          criado_em: string
          data_repasse: string | null
          data_transacao: string
          descricao: string
          empresa_id: string
          hash_duplicidade: string | null
          id: string
          origem_extrato: string | null
          outros_descontos: number | null
          pedido_id: string | null
          referencia_externa: string | null
          responsavel_id: string | null
          status: string
          tarifas: number | null
          taxas: number | null
          tipo_lancamento: string
          tipo_transacao: string
          valor_bruto: number | null
          valor_liquido: number
        }
        Insert: {
          atualizado_em?: string
          canal: string
          canal_venda?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_nome?: string | null
          criado_em?: string
          data_repasse?: string | null
          data_transacao: string
          descricao: string
          empresa_id: string
          hash_duplicidade?: string | null
          id?: string
          origem_extrato?: string | null
          outros_descontos?: number | null
          pedido_id?: string | null
          referencia_externa?: string | null
          responsavel_id?: string | null
          status?: string
          tarifas?: number | null
          taxas?: number | null
          tipo_lancamento: string
          tipo_transacao: string
          valor_bruto?: number | null
          valor_liquido: number
        }
        Update: {
          atualizado_em?: string
          canal?: string
          canal_venda?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_nome?: string | null
          criado_em?: string
          data_repasse?: string | null
          data_transacao?: string
          descricao?: string
          empresa_id?: string
          hash_duplicidade?: string | null
          id?: string
          origem_extrato?: string | null
          outros_descontos?: number | null
          pedido_id?: string | null
          referencia_externa?: string | null
          responsavel_id?: string | null
          status?: string
          tarifas?: number | null
          taxas?: number | null
          tipo_lancamento?: string
          tipo_transacao?: string
          valor_bruto?: number | null
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          custo_medio_anterior: number
          custo_medio_posterior: number
          custo_total: number
          custo_unitario: number
          data: string
          documento: string | null
          empresa_id: string
          estoque_anterior: number
          estoque_posterior: number
          id: string
          motivo: string
          observacoes: string | null
          origem: string
          produto_id: string
          quantidade: number
          referencia_id: string | null
          sku_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          custo_medio_anterior: number
          custo_medio_posterior: number
          custo_total: number
          custo_unitario: number
          data: string
          documento?: string | null
          empresa_id: string
          estoque_anterior: number
          estoque_posterior: number
          id?: string
          motivo: string
          observacoes?: string | null
          origem: string
          produto_id: string
          quantidade: number
          referencia_id?: string | null
          sku_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          custo_medio_anterior?: number
          custo_medio_posterior?: number
          custo_total?: number
          custo_unitario?: number
          data?: string
          documento?: string | null
          empresa_id?: string
          estoque_anterior?: number
          estoque_posterior?: number
          id?: string
          motivo?: string
          observacoes?: string | null
          origem?: string
          produto_id?: string
          quantidade?: number
          referencia_id?: string | null
          sku_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "produto_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentos_financeiros: {
        Row: {
          atualizado_em: string
          categoria_id: string | null
          categoria_nome: string | null
          centro_custo_id: string | null
          centro_custo_nome: string | null
          cliente_nome: string | null
          criado_em: string
          data: string
          descricao: string
          empresa_id: string
          forma_pagamento: string | null
          fornecedor_nome: string | null
          id: string
          observacoes: string | null
          origem: Database["public"]["Enums"]["movimento_origem"]
          referencia_id: string | null
          responsavel_id: string | null
          tipo: Database["public"]["Enums"]["movimento_tipo"]
          valor: number
        }
        Insert: {
          atualizado_em?: string
          categoria_id?: string | null
          categoria_nome?: string | null
          centro_custo_id?: string | null
          centro_custo_nome?: string | null
          cliente_nome?: string | null
          criado_em?: string
          data: string
          descricao: string
          empresa_id: string
          forma_pagamento?: string | null
          fornecedor_nome?: string | null
          id?: string
          observacoes?: string | null
          origem: Database["public"]["Enums"]["movimento_origem"]
          referencia_id?: string | null
          responsavel_id?: string | null
          tipo: Database["public"]["Enums"]["movimento_tipo"]
          valor: number
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string | null
          categoria_nome?: string | null
          centro_custo_id?: string | null
          centro_custo_nome?: string | null
          cliente_nome?: string | null
          criado_em?: string
          data?: string
          descricao?: string
          empresa_id?: string
          forma_pagamento?: string | null
          fornecedor_nome?: string | null
          id?: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["movimento_origem"]
          referencia_id?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["movimento_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_financeiros_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_financeiros_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_import_jobs: {
        Row: {
          arquivo_nome: string
          atualizado_em: string
          criado_em: string
          empresa_id: string
          finalizado_em: string | null
          id: string
          linhas_atualizadas: number
          linhas_com_erro: number
          linhas_importadas: number
          linhas_processadas: number
          mapeamentos_criados: number
          mensagem_erro: string | null
          status: string
          total_linhas: number
        }
        Insert: {
          arquivo_nome: string
          atualizado_em?: string
          criado_em?: string
          empresa_id: string
          finalizado_em?: string | null
          id?: string
          linhas_atualizadas?: number
          linhas_com_erro?: number
          linhas_importadas?: number
          linhas_processadas?: number
          mapeamentos_criados?: number
          mensagem_erro?: string | null
          status?: string
          total_linhas?: number
        }
        Update: {
          arquivo_nome?: string
          atualizado_em?: string
          criado_em?: string
          empresa_id?: string
          finalizado_em?: string | null
          id?: string
          linhas_atualizadas?: number
          linhas_com_erro?: number
          linhas_importadas?: number
          linhas_processadas?: number
          mapeamentos_criados?: number
          mensagem_erro?: string | null
          status?: string
          total_linhas?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_import_jobs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_sku_map: {
        Row: {
          anuncio_id: string | null
          canal: string
          created_at: string
          empresa_id: string
          id: string
          loja: string | null
          produto_id: string | null
          sku_id: string | null
          sku_interno: string
          updated_at: string
          variante_id: string | null
          variante_nome: string | null
        }
        Insert: {
          anuncio_id?: string | null
          canal: string
          created_at?: string
          empresa_id: string
          id?: string
          loja?: string | null
          produto_id?: string | null
          sku_id?: string | null
          sku_interno: string
          updated_at?: string
          variante_id?: string | null
          variante_nome?: string | null
        }
        Update: {
          anuncio_id?: string | null
          canal?: string
          created_at?: string
          empresa_id?: string
          id?: string
          loja?: string | null
          produto_id?: string | null
          sku_id?: string | null
          sku_interno?: string
          updated_at?: string
          variante_id?: string | null
          variante_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_sku_map_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_sku_map_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_sku_map_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "produto_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_skus: {
        Row: {
          ativo: boolean
          codigo_sku: string
          created_at: string
          custo_medio_atual: number
          empresa_id: string
          estoque_atual: number
          id: string
          observacoes: string | null
          produto_id: string
          ultima_atualizacao_custo: string | null
          updated_at: string
          variacao: Json | null
        }
        Insert: {
          ativo?: boolean
          codigo_sku: string
          created_at?: string
          custo_medio_atual?: number
          empresa_id: string
          estoque_atual?: number
          id?: string
          observacoes?: string | null
          produto_id: string
          ultima_atualizacao_custo?: string | null
          updated_at?: string
          variacao?: Json | null
        }
        Update: {
          ativo?: boolean
          codigo_sku?: string
          created_at?: string
          custo_medio_atual?: number
          empresa_id?: string
          estoque_atual?: number
          id?: string
          observacoes?: string | null
          produto_id?: string
          ultima_atualizacao_custo?: string | null
          updated_at?: string
          variacao?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_skus_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_skus_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          canais: Json | null
          categoria: string | null
          cfop_compra: string | null
          cfop_venda: string | null
          codigo_interno: string
          created_at: string
          custo_medio_atual: number
          descricao: string | null
          empresa_id: string
          estoque_atual: number
          fornecedor_principal_id: string | null
          fornecedor_principal_nome: string | null
          id: string
          ncm: string | null
          nome: string
          observacoes: string | null
          preco_venda_sugerido: number | null
          situacao_tributaria: string | null
          status: string
          subcategoria: string | null
          ultima_atualizacao_custo: string | null
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          canais?: Json | null
          categoria?: string | null
          cfop_compra?: string | null
          cfop_venda?: string | null
          codigo_interno: string
          created_at?: string
          custo_medio_atual?: number
          descricao?: string | null
          empresa_id: string
          estoque_atual?: number
          fornecedor_principal_id?: string | null
          fornecedor_principal_nome?: string | null
          id?: string
          ncm?: string | null
          nome: string
          observacoes?: string | null
          preco_venda_sugerido?: number | null
          situacao_tributaria?: string | null
          status?: string
          subcategoria?: string | null
          ultima_atualizacao_custo?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          canais?: Json | null
          categoria?: string | null
          cfop_compra?: string | null
          cfop_venda?: string | null
          codigo_interno?: string
          created_at?: string
          custo_medio_atual?: number
          descricao?: string | null
          empresa_id?: string
          estoque_atual?: number
          fornecedor_principal_id?: string | null
          fornecedor_principal_nome?: string | null
          id?: string
          ncm?: string | null
          nome?: string
          observacoes?: string | null
          preco_venda_sugerido?: number | null
          situacao_tributaria?: string | null
          status?: string
          subcategoria?: string | null
          ultima_atualizacao_custo?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos_compra: {
        Row: {
          compra_id: string
          created_at: string
          data_recebimento: string
          id: string
          observacao: string | null
          usuario_id: string | null
        }
        Insert: {
          compra_id: string
          created_at?: string
          data_recebimento?: string
          id?: string
          observacao?: string | null
          usuario_id?: string | null
        }
        Update: {
          compra_id?: string
          created_at?: string
          data_recebimento?: string
          id?: string
          observacao?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_compra_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos_itens: {
        Row: {
          compra_item_id: string
          created_at: string
          custo_unitario: number
          id: string
          lote: string | null
          observacao: string | null
          produto_id: string | null
          quantidade_devolvida: number
          quantidade_pedida: number | null
          quantidade_recebida: number
          recebimento_id: string
          sku_id: string | null
        }
        Insert: {
          compra_item_id: string
          created_at?: string
          custo_unitario?: number
          id?: string
          lote?: string | null
          observacao?: string | null
          produto_id?: string | null
          quantidade_devolvida?: number
          quantidade_pedida?: number | null
          quantidade_recebida?: number
          recebimento_id: string
          sku_id?: string | null
        }
        Update: {
          compra_item_id?: string
          created_at?: string
          custo_unitario?: number
          id?: string
          lote?: string | null
          observacao?: string | null
          produto_id?: string | null
          quantidade_devolvida?: number
          quantidade_pedida?: number | null
          quantidade_recebida?: number
          recebimento_id?: string
          sku_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_itens_compra_item_id_fkey"
            columns: ["compra_item_id"]
            isOneToOne: false
            referencedRelation: "compras_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_itens_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "produto_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_categorizacao: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          centro_custo_id: string | null
          created_at: string
          estabelecimento_pattern: string
          id: string
          responsavel_id: string | null
          updated_at: string
          uso_count: number
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          estabelecimento_pattern: string
          id?: string
          responsavel_id?: string | null
          updated_at?: string
          uso_count?: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          estabelecimento_pattern?: string
          id?: string
          responsavel_id?: string | null
          updated_at?: string
          uso_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "regras_categorizacao_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_categorizacao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_de_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_categorizacao_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
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
      registrar_movimento_financeiro: {
        Args: {
          p_categoria_id?: string
          p_categoria_nome?: string
          p_centro_custo_id?: string
          p_centro_custo_nome?: string
          p_cliente_nome?: string
          p_data: string
          p_descricao: string
          p_empresa_id: string
          p_forma_pagamento?: string
          p_fornecedor_nome?: string
          p_observacoes?: string
          p_origem: Database["public"]["Enums"]["movimento_origem"]
          p_referencia_id?: string
          p_responsavel_id?: string
          p_tipo: Database["public"]["Enums"]["movimento_tipo"]
          p_valor: number
        }
        Returns: string
      }
    }
    Enums: {
      card_type: "credito" | "debito"
      movimento_origem:
        | "cartao"
        | "banco"
        | "contas_pagar"
        | "contas_receber"
        | "marketplace"
        | "manual"
      movimento_tipo: "entrada" | "saida"
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
      movimento_origem: [
        "cartao",
        "banco",
        "contas_pagar",
        "contas_receber",
        "marketplace",
        "manual",
      ],
      movimento_tipo: ["entrada", "saida"],
      transaction_status: ["conciliado", "pendente", "aprovado", "reprovado"],
      transaction_type: ["recorrente", "pontual"],
    },
  },
} as const
