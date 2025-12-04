/**
 * VALIDAÇÃO DE ESTOQUE PARA MARKETPLACE
 * 
 * Valida se há estoque suficiente antes de conciliar transações.
 * Previne estoque negativo e inconsistências.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ItemParaValidacao {
  id: string;
  sku_marketplace: string | null;
  produto_id: string | null;
  sku_id: string | null;
  quantidade: number;
  descricao_item: string | null;
}

export interface ResultadoValidacaoItem {
  item_id: string;
  sku_marketplace: string | null;
  produto_nome: string | null;
  quantidade_solicitada: number;
  estoque_disponivel: number;
  valido: boolean;
  mensagem: string;
}

export interface ResultadoValidacaoEstoque {
  valido: boolean;
  itens: ResultadoValidacaoItem[];
  mensagem_geral: string;
  itens_sem_vinculacao: number;
  itens_com_estoque_insuficiente: number;
}

/**
 * Valida estoque de todos os itens de uma transação antes de conciliar
 */
export async function validarEstoqueParaConciliacao(
  transactionId: string,
  empresaId: string
): Promise<ResultadoValidacaoEstoque> {
  const resultado: ResultadoValidacaoEstoque = {
    valido: true,
    itens: [],
    mensagem_geral: "",
    itens_sem_vinculacao: 0,
    itens_com_estoque_insuficiente: 0,
  };

  // 1. Buscar itens da transação
  const { data: itens, error: itensError } = await supabase
    .from("marketplace_transaction_items")
    .select("id, sku_marketplace, produto_id, sku_id, quantidade, descricao_item")
    .eq("transaction_id", transactionId);

  if (itensError) {
    resultado.valido = false;
    resultado.mensagem_geral = `Erro ao buscar itens: ${itensError.message}`;
    return resultado;
  }

  if (!itens || itens.length === 0) {
    // Sem itens = sem validação de estoque necessária
    resultado.mensagem_geral = "Nenhum item vinculado. Estoque não será afetado.";
    return resultado;
  }

  // 2. Validar cada item
  for (const item of itens) {
    const validacaoItem: ResultadoValidacaoItem = {
      item_id: item.id,
      sku_marketplace: item.sku_marketplace,
      produto_nome: item.descricao_item,
      quantidade_solicitada: Number(item.quantidade) || 1,
      estoque_disponivel: 0,
      valido: true,
      mensagem: "",
    };

    if (!item.produto_id && !item.sku_id) {
      // Item sem vinculação
      validacaoItem.valido = true; // Não bloqueia, apenas avisa
      validacaoItem.mensagem = "Sem vinculação de produto. Estoque não será baixado.";
      resultado.itens_sem_vinculacao++;
    } else if (item.sku_id) {
      // Validar por SKU
      const { data: sku, error: skuError } = await supabase
        .from("produto_skus")
        .select("codigo_sku, estoque_atual, produto:produtos(nome)")
        .eq("id", item.sku_id)
        .single();

      if (skuError || !sku) {
        validacaoItem.valido = false;
        validacaoItem.mensagem = "SKU não encontrado no sistema.";
        resultado.valido = false;
        resultado.itens_com_estoque_insuficiente++;
      } else {
        const estoqueAtual = Number(sku.estoque_atual) || 0;
        validacaoItem.estoque_disponivel = estoqueAtual;
        validacaoItem.produto_nome = `${(sku.produto as any)?.nome || ''} - ${sku.codigo_sku}`;

        if (estoqueAtual < validacaoItem.quantidade_solicitada) {
          validacaoItem.valido = false;
          validacaoItem.mensagem = `Estoque insuficiente. Disponível: ${estoqueAtual}, Necessário: ${validacaoItem.quantidade_solicitada}`;
          resultado.valido = false;
          resultado.itens_com_estoque_insuficiente++;
        } else {
          validacaoItem.mensagem = "OK";
        }
      }
    } else if (item.produto_id) {
      // Validar por Produto
      const { data: produto, error: prodError } = await supabase
        .from("produtos")
        .select("nome, estoque_atual")
        .eq("id", item.produto_id)
        .single();

      if (prodError || !produto) {
        validacaoItem.valido = false;
        validacaoItem.mensagem = "Produto não encontrado no sistema.";
        resultado.valido = false;
        resultado.itens_com_estoque_insuficiente++;
      } else {
        const estoqueAtual = Number(produto.estoque_atual) || 0;
        validacaoItem.estoque_disponivel = estoqueAtual;
        validacaoItem.produto_nome = produto.nome;

        if (estoqueAtual < validacaoItem.quantidade_solicitada) {
          validacaoItem.valido = false;
          validacaoItem.mensagem = `Estoque insuficiente. Disponível: ${estoqueAtual}, Necessário: ${validacaoItem.quantidade_solicitada}`;
          resultado.valido = false;
          resultado.itens_com_estoque_insuficiente++;
        } else {
          validacaoItem.mensagem = "OK";
        }
      }
    }

    resultado.itens.push(validacaoItem);
  }

  // 3. Mensagem geral
  if (resultado.valido) {
    if (resultado.itens_sem_vinculacao > 0) {
      resultado.mensagem_geral = `Validação OK. ${resultado.itens_sem_vinculacao} item(s) sem vinculação serão ignorados.`;
    } else {
      resultado.mensagem_geral = "Estoque validado com sucesso.";
    }
  } else {
    resultado.mensagem_geral = `${resultado.itens_com_estoque_insuficiente} item(s) com estoque insuficiente.`;
  }

  return resultado;
}

/**
 * Verifica rapidamente se há itens vinculados na transação
 */
export async function temItensVinculados(transactionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("marketplace_transaction_items")
    .select("id")
    .eq("transaction_id", transactionId)
    .or("produto_id.not.is.null,sku_id.not.is.null")
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Conta itens sem vinculação (para avisos na UI)
 */
export async function contarItensSemVinculacao(transactionId: string): Promise<number> {
  const { data, error } = await supabase
    .from("marketplace_transaction_items")
    .select("id")
    .eq("transaction_id", transactionId)
    .is("produto_id", null)
    .is("sku_id", null);

  if (error) return 0;
  return data?.length ?? 0;
}
