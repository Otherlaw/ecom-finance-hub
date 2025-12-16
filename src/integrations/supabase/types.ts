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
      armazens: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          empresa_id: string
          endereco?: string | null
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "armazens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
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
      checklist_canal_arquivos: {
        Row: {
          checklist_item_id: string
          data_upload: string
          id: string
          nome_arquivo: string
          processado: boolean
          resultado_processamento: Json | null
          tamanho_bytes: number | null
          tipo_mime: string | null
          transacoes_importadas: number | null
          url: string
        }
        Insert: {
          checklist_item_id: string
          data_upload?: string
          id?: string
          nome_arquivo: string
          processado?: boolean
          resultado_processamento?: Json | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          transacoes_importadas?: number | null
          url: string
        }
        Update: {
          checklist_item_id?: string
          data_upload?: string
          id?: string
          nome_arquivo?: string
          processado?: boolean
          resultado_processamento?: Json | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          transacoes_importadas?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_canal_arquivos_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_canal_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_canal_itens: {
        Row: {
          atualizado_em: string
          bloqueia_fechamento: boolean
          checklist_id: string
          criado_em: string
          data_hora_conclusao: string | null
          descricao: string | null
          exige_upload: boolean
          id: string
          nome: string
          obrigatorio: boolean
          observacoes: string | null
          ordem: number
          responsavel: string | null
          status: string
          tipo_etapa: string
        }
        Insert: {
          atualizado_em?: string
          bloqueia_fechamento?: boolean
          checklist_id: string
          criado_em?: string
          data_hora_conclusao?: string | null
          descricao?: string | null
          exige_upload?: boolean
          id?: string
          nome: string
          obrigatorio?: boolean
          observacoes?: string | null
          ordem?: number
          responsavel?: string | null
          status?: string
          tipo_etapa?: string
        }
        Update: {
          atualizado_em?: string
          bloqueia_fechamento?: boolean
          checklist_id?: string
          criado_em?: string
          data_hora_conclusao?: string | null
          descricao?: string | null
          exige_upload?: boolean
          id?: string
          nome?: string
          obrigatorio?: boolean
          observacoes?: string | null
          ordem?: number
          responsavel?: string | null
          status?: string
          tipo_etapa?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_canal_itens_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists_canal"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_etapas: {
        Row: {
          ano: number
          codigo_etapa: string
          concluidas: number | null
          created_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          importancia: string | null
          link_acao: string | null
          mes: number
          nome_etapa: string
          pendencias: number | null
          secao: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          codigo_etapa: string
          concluidas?: number | null
          created_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          importancia?: string | null
          link_acao?: string | null
          mes: number
          nome_etapa: string
          pendencias?: number | null
          secao: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          codigo_etapa?: string
          concluidas?: number | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          importancia?: string | null
          link_acao?: string | null
          mes?: number
          nome_etapa?: string
          pendencias?: number | null
          secao?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_logs: {
        Row: {
          acao: string
          created_at: string | null
          detalhes: Json | null
          etapa_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          detalhes?: Json | null
          etapa_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          detalhes?: Json | null
          etapa_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_logs_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "checklist_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists_canal: {
        Row: {
          ano: number
          atualizado_em: string
          canal_id: string
          canal_nome: string
          criado_em: string
          descricao: string | null
          empresa_id: string
          id: string
          mes: number
          status: string
        }
        Insert: {
          ano: number
          atualizado_em?: string
          canal_id: string
          canal_nome: string
          criado_em?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          mes: number
          status?: string
        }
        Update: {
          ano?: number
          atualizado_em?: string
          canal_id?: string
          canal_nome?: string
          criado_em?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          mes?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_canal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_registros: {
        Row: {
          armazem_id: string | null
          canal: string | null
          created_at: string
          custo_total: number
          custo_unitario: number
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
        }
        Insert: {
          armazem_id?: string | null
          canal?: string | null
          created_at?: string
          custo_total: number
          custo_unitario: number
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
        }
        Update: {
          armazem_id?: string | null
          canal?: string | null
          created_at?: string
          custo_total?: number
          custo_unitario?: number
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
        }
        Relationships: [
          {
            foreignKeyName: "cmv_registros_armazem_id_fkey"
            columns: ["armazem_id"]
            isOneToOne: false
            referencedRelation: "armazens"
            referencedColumns: ["id"]
          },
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
        ]
      }
      compras: {
        Row: {
          armazem_destino_id: string | null
          chave_acesso: string | null
          condicao_pagamento: string | null
          created_at: string
          data_nf: string | null
          data_pedido: string
          data_previsao: string | null
          data_vencimento: string | null
          empresa_id: string
          forma_pagamento: string | null
          fornecedor_cnpj: string | null
          fornecedor_nome: string
          gerar_conta_pagar: boolean | null
          id: string
          numero: string | null
          numero_nf: string | null
          observacoes: string | null
          outras_despesas: number | null
          prazo_dias: number | null
          status: string
          uf_emitente: string | null
          updated_at: string
          valor_desconto: number
          valor_frete: number
          valor_icms_st: number | null
          valor_produtos: number
          valor_total: number
        }
        Insert: {
          armazem_destino_id?: string | null
          chave_acesso?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          data_nf?: string | null
          data_pedido?: string
          data_previsao?: string | null
          data_vencimento?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_nome: string
          gerar_conta_pagar?: boolean | null
          id?: string
          numero?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          outras_despesas?: number | null
          prazo_dias?: number | null
          status?: string
          uf_emitente?: string | null
          updated_at?: string
          valor_desconto?: number
          valor_frete?: number
          valor_icms_st?: number | null
          valor_produtos?: number
          valor_total?: number
        }
        Update: {
          armazem_destino_id?: string | null
          chave_acesso?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          data_nf?: string | null
          data_pedido?: string
          data_previsao?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string
          gerar_conta_pagar?: boolean | null
          id?: string
          numero?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          outras_despesas?: number | null
          prazo_dias?: number | null
          status?: string
          uf_emitente?: string | null
          updated_at?: string
          valor_desconto?: number
          valor_frete?: number
          valor_icms_st?: number | null
          valor_produtos?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_armazem_destino_id_fkey"
            columns: ["armazem_destino_id"]
            isOneToOne: false
            referencedRelation: "armazens"
            referencedColumns: ["id"]
          },
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
          aliquota_ipi: number | null
          cfop: string | null
          codigo_nf: string | null
          compra_id: string
          created_at: string
          descricao_nf: string
          id: string
          mapeado: boolean
          ncm: string | null
          produto_id: string | null
          quantidade: number
          quantidade_recebida: number
          updated_at: string
          valor_icms: number | null
          valor_icms_st: number | null
          valor_ipi: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          cfop?: string | null
          codigo_nf?: string | null
          compra_id: string
          created_at?: string
          descricao_nf: string
          id?: string
          mapeado?: boolean
          ncm?: string | null
          produto_id?: string | null
          quantidade?: number
          quantidade_recebida?: number
          updated_at?: string
          valor_icms?: number | null
          valor_icms_st?: number | null
          valor_ipi?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          cfop?: string | null
          codigo_nf?: string | null
          compra_id?: string
          created_at?: string
          descricao_nf?: string
          id?: string
          mapeado?: boolean
          ncm?: string | null
          produto_id?: string | null
          quantidade?: number
          quantidade_recebida?: number
          updated_at?: string
          valor_icms?: number | null
          valor_icms_st?: number | null
          valor_ipi?: number | null
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
        ]
      }
      contas_a_pagar: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          compra_id: string | null
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
          numero_parcela: number | null
          observacoes: string | null
          recorrente: boolean
          status: string
          tipo_lancamento: string
          total_parcelas: number | null
          updated_at: string
          valor_em_aberto: number
          valor_pago: number
          valor_total: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          compra_id?: string | null
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
          numero_parcela?: number | null
          observacoes?: string | null
          recorrente?: boolean
          status?: string
          tipo_lancamento?: string
          total_parcelas?: number | null
          updated_at?: string
          valor_em_aberto: number
          valor_pago?: number
          valor_total: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          compra_id?: string | null
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
          numero_parcela?: number | null
          observacoes?: string | null
          recorrente?: boolean
          status?: string
          tipo_lancamento?: string
          total_parcelas?: number | null
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
            foreignKeyName: "contas_a_pagar_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
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
      creditos_icms: {
        Row: {
          aliquota_icms: number
          cfop: string | null
          chave_acesso: string | null
          created_at: string
          data_competencia: string
          data_lancamento: string
          descricao: string
          empresa_id: string
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          ncm: string
          numero_nf: string | null
          observacoes: string | null
          origem_credito: string
          origem_descricao: string | null
          percentual_aproveitamento: number
          quantidade: number
          status_credito: string
          tipo_credito: string
          uf_origem: string | null
          updated_at: string
          valor_ajustes: number
          valor_credito: number
          valor_credito_bruto: number
          valor_icms_destacado: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota_icms?: number
          cfop?: string | null
          chave_acesso?: string | null
          created_at?: string
          data_competencia: string
          data_lancamento?: string
          descricao: string
          empresa_id: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          ncm: string
          numero_nf?: string | null
          observacoes?: string | null
          origem_credito: string
          origem_descricao?: string | null
          percentual_aproveitamento?: number
          quantidade?: number
          status_credito?: string
          tipo_credito: string
          uf_origem?: string | null
          updated_at?: string
          valor_ajustes?: number
          valor_credito?: number
          valor_credito_bruto?: number
          valor_icms_destacado?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          aliquota_icms?: number
          cfop?: string | null
          chave_acesso?: string | null
          created_at?: string
          data_competencia?: string
          data_lancamento?: string
          descricao?: string
          empresa_id?: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          ncm?: string
          numero_nf?: string | null
          observacoes?: string | null
          origem_credito?: string
          origem_descricao?: string | null
          percentual_aproveitamento?: number
          quantidade?: number
          status_credito?: string
          tipo_credito?: string
          uf_origem?: string | null
          updated_at?: string
          valor_ajustes?: number
          valor_credito?: number
          valor_credito_bruto?: number
          valor_icms_destacado?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "creditos_icms_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_icms_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          capital_inicial: number | null
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
          capital_inicial?: number | null
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
          capital_inicial?: number | null
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
      empresas_config_fiscal: {
        Row: {
          aliquota_icms: number | null
          aliquota_imposto_vendas: number
          aliquota_pis_cofins: number | null
          atualizado_em: string | null
          criado_em: string | null
          empresa_id: string
          id: string
        }
        Insert: {
          aliquota_icms?: number | null
          aliquota_imposto_vendas?: number
          aliquota_pis_cofins?: number | null
          atualizado_em?: string | null
          criado_em?: string | null
          empresa_id: string
          id?: string
        }
        Update: {
          aliquota_icms?: number | null
          aliquota_imposto_vendas?: number
          aliquota_pis_cofins?: number | null
          atualizado_em?: string | null
          criado_em?: string | null
          empresa_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_config_fiscal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque: {
        Row: {
          armazem_id: string
          created_at: string
          custo_medio: number
          empresa_id: string
          estoque_maximo: number | null
          estoque_minimo: number | null
          id: string
          localizacao: string | null
          lote: string | null
          ponto_reposicao: number | null
          produto_id: string
          quantidade: number
          quantidade_disponivel: number | null
          quantidade_reservada: number
          updated_at: string
          validade: string | null
        }
        Insert: {
          armazem_id: string
          created_at?: string
          custo_medio?: number
          empresa_id: string
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          id?: string
          localizacao?: string | null
          lote?: string | null
          ponto_reposicao?: number | null
          produto_id: string
          quantidade?: number
          quantidade_disponivel?: number | null
          quantidade_reservada?: number
          updated_at?: string
          validade?: string | null
        }
        Update: {
          armazem_id?: string
          created_at?: string
          custo_medio?: number
          empresa_id?: string
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          id?: string
          localizacao?: string | null
          lote?: string | null
          ponto_reposicao?: number | null
          produto_id?: string
          quantidade?: number
          quantidade_disponivel?: number | null
          quantidade_reservada?: number
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_armazem_id_fkey"
            columns: ["armazem_id"]
            isOneToOne: false
            referencedRelation: "armazens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          cnpj: string | null
          contato_cargo: string | null
          contato_celular: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          empresa_id: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          forma_pagamento_preferencial: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          observacoes: string | null
          origem: string | null
          prazo_medio_dias: number | null
          razao_social: string
          regime_tributario: string | null
          segmento: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contato_cargo?: string | null
          contato_celular?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          empresa_id?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          forma_pagamento_preferencial?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string | null
          prazo_medio_dias?: number | null
          razao_social: string
          regime_tributario?: string | null
          segmento?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contato_cargo?: string | null
          contato_celular?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          empresa_id?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          forma_pagamento_preferencial?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string | null
          prazo_medio_dias?: number | null
          razao_social?: string
          regime_tributario?: string | null
          segmento?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_config: {
        Row: {
          ativo: boolean
          auto_categorize: boolean | null
          auto_reconcile: boolean | null
          created_at: string
          empresa_id: string
          id: string
          last_sync_at: string | null
          next_sync_at: string | null
          provider: string
          settings: Json | null
          sync_frequency_minutes: number | null
          updated_at: string
          webhook_enabled: boolean | null
          webhook_secret: string | null
        }
        Insert: {
          ativo?: boolean
          auto_categorize?: boolean | null
          auto_reconcile?: boolean | null
          created_at?: string
          empresa_id: string
          id?: string
          last_sync_at?: string | null
          next_sync_at?: string | null
          provider: string
          settings?: Json | null
          sync_frequency_minutes?: number | null
          updated_at?: string
          webhook_enabled?: boolean | null
          webhook_secret?: string | null
        }
        Update: {
          ativo?: boolean
          auto_categorize?: boolean | null
          auto_reconcile?: boolean | null
          created_at?: string
          empresa_id?: string
          id?: string
          last_sync_at?: string | null
          next_sync_at?: string | null
          provider?: string
          settings?: Json | null
          sync_frequency_minutes?: number | null
          updated_at?: string
          webhook_enabled?: boolean | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracao_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_logs: {
        Row: {
          created_at: string
          detalhes: Json | null
          duracao_ms: number | null
          empresa_id: string
          id: string
          mensagem: string | null
          provider: string
          registros_atualizados: number | null
          registros_criados: number | null
          registros_erro: number | null
          registros_processados: number | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          duracao_ms?: number | null
          empresa_id: string
          id?: string
          mensagem?: string | null
          provider: string
          registros_atualizados?: number | null
          registros_criados?: number | null
          registros_erro?: number | null
          registros_processados?: number | null
          status: string
          tipo: string
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          duracao_ms?: number | null
          empresa_id?: string
          id?: string
          mensagem?: string | null
          provider?: string
          registros_atualizados?: number | null
          registros_criados?: number | null
          registros_erro?: number | null
          registros_processados?: number | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracao_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_tokens: {
        Row: {
          access_token: string
          created_at: string
          empresa_id: string
          expires_at: string | null
          id: string
          metadata: Json | null
          provider: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id_provider: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          empresa_id: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id_provider?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          empresa_id?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracao_tokens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "marketplace_transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "marketplace_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "vw_vendas_detalhadas"
            referencedColumns: ["transacao_id"]
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
          custo_ads: number | null
          data_repasse: string | null
          data_transacao: string
          descricao: string
          empresa_id: string
          frete_comprador: number | null
          frete_vendedor: number | null
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
          tipo_envio: string | null
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
          custo_ads?: number | null
          data_repasse?: string | null
          data_transacao: string
          descricao: string
          empresa_id: string
          frete_comprador?: number | null
          frete_vendedor?: number | null
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
          tipo_envio?: string | null
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
          custo_ads?: number | null
          data_repasse?: string | null
          data_transacao?: string
          descricao?: string
          empresa_id?: string
          frete_comprador?: number | null
          frete_vendedor?: number | null
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
          tipo_envio?: string | null
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
          armazem_destino_id: string | null
          armazem_id: string
          created_at: string
          custo_medio_anterior: number
          custo_medio_posterior: number
          custo_total: number
          custo_unitario: number
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
          tipo: string
        }
        Insert: {
          armazem_destino_id?: string | null
          armazem_id: string
          created_at?: string
          custo_medio_anterior?: number
          custo_medio_posterior?: number
          custo_total?: number
          custo_unitario?: number
          documento?: string | null
          empresa_id: string
          estoque_anterior?: number
          estoque_posterior?: number
          id?: string
          motivo: string
          observacoes?: string | null
          origem: string
          produto_id: string
          quantidade: number
          referencia_id?: string | null
          tipo: string
        }
        Update: {
          armazem_destino_id?: string | null
          armazem_id?: string
          created_at?: string
          custo_medio_anterior?: number
          custo_medio_posterior?: number
          custo_total?: number
          custo_unitario?: number
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
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_armazem_destino_id_fkey"
            columns: ["armazem_destino_id"]
            isOneToOne: false
            referencedRelation: "armazens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_armazem_id_fkey"
            columns: ["armazem_id"]
            isOneToOne: false
            referencedRelation: "armazens"
            referencedColumns: ["id"]
          },
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
      onboarding_status: {
        Row: {
          centros_custo_revisados: boolean
          created_at: string
          dados_empresa_completos: boolean
          empresa_criada: boolean
          empresa_id: string | null
          id: string
          onboarding_completo: boolean
          plano_contas_revisado: boolean
          primeira_importacao: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          centros_custo_revisados?: boolean
          created_at?: string
          dados_empresa_completos?: boolean
          empresa_criada?: boolean
          empresa_id?: string | null
          id?: string
          onboarding_completo?: boolean
          plano_contas_revisado?: boolean
          primeira_importacao?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          centros_custo_revisados?: boolean
          created_at?: string
          dados_empresa_completos?: boolean
          empresa_criada?: boolean
          empresa_id?: string | null
          id?: string
          onboarding_completo?: boolean
          plano_contas_revisado?: boolean
          primeira_importacao?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_status_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      origens_credito_icms: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "origens_credito_icms_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      patrimonio_bens: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          data_aquisicao: string
          depreciacao_acumulada: number | null
          descricao: string
          empresa_id: string
          grupo_balanco: string
          id: string
          observacoes: string | null
          tipo: string
          valor_aquisicao: number
          valor_residual: number | null
          vida_util_meses: number | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          data_aquisicao: string
          depreciacao_acumulada?: number | null
          descricao: string
          empresa_id: string
          grupo_balanco: string
          id?: string
          observacoes?: string | null
          tipo: string
          valor_aquisicao: number
          valor_residual?: number | null
          vida_util_meses?: number | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          data_aquisicao?: string
          depreciacao_acumulada?: number | null
          descricao?: string
          empresa_id?: string
          grupo_balanco?: string
          id?: string
          observacoes?: string | null
          tipo?: string
          valor_aquisicao?: number
          valor_residual?: number | null
          vida_util_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patrimonio_bens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      patrimonio_pl_movimentos: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_referencia: string
          descricao: string | null
          empresa_id: string
          grupo_pl: string
          id: string
          tipo: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_referencia: string
          descricao?: string | null
          empresa_id: string
          grupo_pl: string
          id?: string
          tipo: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_referencia?: string
          descricao?: string | null
          empresa_id?: string
          grupo_pl?: string
          id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "patrimonio_pl_movimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      produto_marketplace_map: {
        Row: {
          anuncio_id: string | null
          ativo: boolean
          canal: string
          created_at: string
          empresa_id: string
          id: string
          mapeado_automaticamente: boolean | null
          nome_anuncio: string | null
          nome_loja: string | null
          produto_id: string
          sku_marketplace: string
          updated_at: string
          variante_id: string | null
        }
        Insert: {
          anuncio_id?: string | null
          ativo?: boolean
          canal: string
          created_at?: string
          empresa_id: string
          id?: string
          mapeado_automaticamente?: boolean | null
          nome_anuncio?: string | null
          nome_loja?: string | null
          produto_id: string
          sku_marketplace: string
          updated_at?: string
          variante_id?: string | null
        }
        Update: {
          anuncio_id?: string | null
          ativo?: boolean
          canal?: string
          created_at?: string
          empresa_id?: string
          id?: string
          mapeado_automaticamente?: boolean | null
          nome_anuncio?: string | null
          nome_loja?: string | null
          produto_id?: string
          sku_marketplace?: string
          updated_at?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_marketplace_map_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_marketplace_map_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          altura_cm: number | null
          atributos_variacao: Json | null
          categoria: string | null
          cfop_compra: string | null
          cfop_venda: string | null
          created_at: string
          custo_medio: number
          descricao: string | null
          empresa_id: string
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          imagem_url: string | null
          kit_componentes: Json | null
          largura_cm: number | null
          marca: string | null
          ncm: string | null
          nome: string
          parent_id: string | null
          peso_kg: number | null
          preco_venda: number
          profundidade_cm: number | null
          situacao_tributaria: string | null
          sku: string
          status: string
          subcategoria: string | null
          tipo: string
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          altura_cm?: number | null
          atributos_variacao?: Json | null
          categoria?: string | null
          cfop_compra?: string | null
          cfop_venda?: string | null
          created_at?: string
          custo_medio?: number
          descricao?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          imagem_url?: string | null
          kit_componentes?: Json | null
          largura_cm?: number | null
          marca?: string | null
          ncm?: string | null
          nome: string
          parent_id?: string | null
          peso_kg?: number | null
          preco_venda?: number
          profundidade_cm?: number | null
          situacao_tributaria?: string | null
          sku: string
          status?: string
          subcategoria?: string | null
          tipo?: string
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          altura_cm?: number | null
          atributos_variacao?: Json | null
          categoria?: string | null
          cfop_compra?: string | null
          cfop_venda?: string | null
          created_at?: string
          custo_medio?: number
          descricao?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          imagem_url?: string | null
          kit_componentes?: Json | null
          largura_cm?: number | null
          marca?: string | null
          ncm?: string | null
          nome?: string
          parent_id?: string | null
          peso_kg?: number | null
          preco_venda?: number
          profundidade_cm?: number | null
          situacao_tributaria?: string | null
          sku?: string
          status?: string
          subcategoria?: string | null
          tipo?: string
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
          {
            foreignKeyName: "produtos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          empresa_padrao_id: string | null
          id: string
          nome: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          empresa_padrao_id?: string | null
          id: string
          nome?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          empresa_padrao_id?: string | null
          id?: string
          nome?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_padrao_id_fkey"
            columns: ["empresa_padrao_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          armazem_id: string
          compra_id: string
          created_at: string
          data_recebimento: string
          id: string
          observacoes: string | null
        }
        Insert: {
          armazem_id: string
          compra_id: string
          created_at?: string
          data_recebimento?: string
          id?: string
          observacoes?: string | null
        }
        Update: {
          armazem_id?: string
          compra_id?: string
          created_at?: string
          data_recebimento?: string
          id?: string
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_armazem_id_fkey"
            columns: ["armazem_id"]
            isOneToOne: false
            referencedRelation: "armazens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_compra_id_fkey"
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
          localizacao: string | null
          lote: string | null
          observacao: string | null
          produto_id: string | null
          quantidade_devolvida: number
          quantidade_recebida: number
          recebimento_id: string
          validade: string | null
        }
        Insert: {
          compra_item_id: string
          created_at?: string
          custo_unitario?: number
          id?: string
          localizacao?: string | null
          lote?: string | null
          observacao?: string | null
          produto_id?: string | null
          quantidade_devolvida?: number
          quantidade_recebida?: number
          recebimento_id: string
          validade?: string | null
        }
        Update: {
          compra_item_id?: string
          created_at?: string
          custo_unitario?: number
          id?: string
          localizacao?: string | null
          lote?: string | null
          observacao?: string | null
          produto_id?: string | null
          quantidade_devolvida?: number
          quantidade_recebida?: number
          recebimento_id?: string
          validade?: string | null
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
            referencedRelation: "recebimentos"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "regras_categorizacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
          funcao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          empresa_id: string
          funcao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          empresa_id?: string
          funcao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsaveis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_progress: {
        Row: {
          atualizado_em: string | null
          concluido: boolean | null
          criado_em: string | null
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          step_atual: number | null
          tutorial_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string | null
          concluido?: boolean | null
          criado_em?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          step_atual?: number | null
          tutorial_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string | null
          concluido?: boolean | null
          criado_em?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          step_atual?: number | null
          tutorial_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_empresas: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_vendas_detalhadas: {
        Row: {
          anuncio_id: string | null
          canal: string | null
          canal_venda: string | null
          cmv_total: number | null
          conta_nome: string | null
          custo_ads: number | null
          custo_medio: number | null
          data_repasse: string | null
          data_venda: string | null
          descricao: string | null
          descricao_item: string | null
          empresa_id: string | null
          frete_comprador: number | null
          frete_vendedor: number | null
          item_id: string | null
          margem_bruta: number | null
          margem_percentual: number | null
          nao_conciliado: boolean | null
          outros_descontos: number | null
          pedido_id: string | null
          preco_total: number | null
          preco_unitario: number | null
          produto_id: string | null
          produto_nome: string | null
          quantidade: number | null
          sem_categoria: boolean | null
          sem_custo: boolean | null
          sem_produto_vinculado: boolean | null
          sku_interno: string | null
          sku_marketplace: string | null
          status: string | null
          tarifas: number | null
          taxas: number | null
          teve_ads: boolean | null
          tipo_envio: string | null
          tipo_lancamento: string | null
          tipo_transacao: string | null
          transacao_id: string | null
          valor_bruto: number | null
          valor_liquido: number | null
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
            foreignKeyName: "marketplace_transactions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_financial_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      user_has_empresa_access: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "financeiro" | "socio" | "operador"
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
      app_role: ["admin", "financeiro", "socio", "operador"],
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
