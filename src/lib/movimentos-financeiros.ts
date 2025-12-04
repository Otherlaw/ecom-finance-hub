/**
 * Motor de Entrada Unificada (MEU)
 * 
 * Função utilitária para registrar movimentos financeiros na tabela centralizada.
 * Todos os lançamentos financeiros devem passar por aqui.
 */

import { supabase } from "@/integrations/supabase/client";

export type TipoMovimento = "entrada" | "saida";
export type OrigemMovimento = "cartao" | "banco" | "contas_pagar" | "contas_receber" | "marketplace" | "manual";

export interface DadosMovimentoFinanceiro {
  data: string; // formato YYYY-MM-DD
  tipo: TipoMovimento;
  origem: OrigemMovimento;
  descricao: string;
  valor: number;
  empresaId: string;
  referenciaId?: string; // ID do registro original (para upsert)
  categoriaId?: string;
  categoriaNome?: string;
  centroCustoId?: string;
  centroCustoNome?: string;
  responsavelId?: string;
  formaPagamento?: string;
  clienteNome?: string;
  fornecedorNome?: string;
  observacoes?: string;
}

/**
 * Registra um movimento financeiro na tabela centralizada.
 * Se já existir um movimento com mesma referencia_id + origem, atualiza.
 * 
 * @param dados - Dados do movimento a ser registrado
 * @returns ID do movimento criado/atualizado
 * @throws Error se falhar validação ou inserção
 */
export async function registrarMovimentoFinanceiro(dados: DadosMovimentoFinanceiro): Promise<string> {
  // Validações básicas
  if (!dados.data) {
    throw new Error("Campo data é obrigatório");
  }
  
  if (!dados.valor || dados.valor <= 0) {
    throw new Error("Campo valor deve ser maior que zero");
  }
  
  if (!dados.empresaId) {
    throw new Error("Campo empresaId é obrigatório");
  }

  // Chama a função do banco (usa upsert)
  const { data, error } = await supabase.rpc("registrar_movimento_financeiro", {
    p_data: dados.data,
    p_tipo: dados.tipo,
    p_origem: dados.origem,
    p_descricao: dados.descricao,
    p_valor: dados.valor,
    p_empresa_id: dados.empresaId,
    p_referencia_id: dados.referenciaId || null,
    p_categoria_id: dados.categoriaId || null,
    p_categoria_nome: dados.categoriaNome || null,
    p_centro_custo_id: dados.centroCustoId || null,
    p_centro_custo_nome: dados.centroCustoNome || null,
    p_responsavel_id: dados.responsavelId || null,
    p_forma_pagamento: dados.formaPagamento || null,
    p_cliente_nome: dados.clienteNome || null,
    p_fornecedor_nome: dados.fornecedorNome || null,
    p_observacoes: dados.observacoes || null,
  });

  if (error) {
    console.error("Erro ao registrar movimento financeiro:", error);
    throw new Error(`Erro ao registrar movimento: ${error.message}`);
  }

  return data as string;
}

/**
 * Remove um movimento financeiro da tabela centralizada.
 * 
 * @param referenciaId - ID do registro original
 * @param origem - Origem do movimento
 */
export async function removerMovimentoFinanceiro(referenciaId: string, origem: OrigemMovimento): Promise<void> {
  const { error } = await supabase
    .from("movimentos_financeiros")
    .delete()
    .eq("referencia_id", referenciaId)
    .eq("origem", origem);

  if (error) {
    console.error("Erro ao remover movimento financeiro:", error);
    throw new Error(`Erro ao remover movimento: ${error.message}`);
  }
}
