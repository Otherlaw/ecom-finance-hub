/**
 * Hook para gerenciamento de compras - Nova Estrutura V2
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export type StatusCompra = 'rascunho' | 'emitido' | 'em_transito' | 'parcial' | 'concluido' | 'cancelado';

export const STATUS_LIST: StatusCompra[] = ['rascunho', 'emitido', 'em_transito', 'parcial', 'concluido', 'cancelado'];

export const STATUS_COMPRA_LABELS: Record<StatusCompra, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
  emitido: { label: "Emitido", color: "bg-blue-100 text-blue-800" },
  em_transito: { label: "Em Trânsito", color: "bg-yellow-100 text-yellow-800" },
  parcial: { label: "Parcial", color: "bg-orange-100 text-orange-800" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

export interface CompraItem {
  id: string;
  compra_id: string;
  produto_id: string | null;
  codigo_nf: string | null;
  descricao_nf: string;
  ncm: string | null;
  cfop: string | null;
  quantidade: number;
  quantidade_recebida: number;
  valor_unitario: number;
  valor_total: number;
  aliquota_icms: number | null;
  valor_icms: number | null;
  aliquota_ipi: number | null;
  valor_ipi: number | null;
  mapeado: boolean;
  created_at: string;
  updated_at: string;
}

export interface Compra {
  id: string;
  empresa_id: string;
  numero: string | null;
  fornecedor_nome: string;
  fornecedor_cnpj: string | null;
  data_pedido: string;
  data_previsao: string | null;
  valor_produtos: number;
  valor_frete: number;
  valor_desconto: number;
  valor_total: number;
  numero_nf: string | null;
  chave_acesso: string | null;
  data_nf: string | null;
  status: StatusCompra;
  armazem_destino_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  itens?: CompraItem[];
}

export interface CompraInsert {
  empresa_id: string;
  numero?: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  data_pedido: string;
  data_previsao?: string;
  valor_produtos?: number;
  valor_frete?: number;
  valor_desconto?: number;
  valor_total?: number;
  numero_nf?: string;
  chave_acesso?: string;
  data_nf?: string;
  status?: StatusCompra;
  armazem_destino_id?: string;
  observacoes?: string;
  // Campos de pagamento
  forma_pagamento?: string;
  condicao_pagamento?: string;
  prazo_dias?: number;
  data_vencimento?: string;
  gerar_conta_pagar?: boolean;
  numero_parcelas?: number;
  // Campos para custo efetivo e ICMS
  valor_icms_st?: number;
  outras_despesas?: number;
  uf_emitente?: string | null;
}

export interface UseComprasParams {
  empresaId?: string;
  status?: StatusCompra | 'todos';
  busca?: string;
}

// ============= HOOK PRINCIPAL =============

export function useCompras(params: UseComprasParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, status = 'todos', busca } = params;

  const {
    data: compras = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["compras", empresaId, status, busca],
    queryFn: async () => {
      let query = supabase
        .from("compras")
        .select(`
          *,
          itens:compras_itens(*)
        `)
        .order("data_pedido", { ascending: false });

      if (empresaId) query = query.eq("empresa_id", empresaId);
      if (status && status !== 'todos') query = query.eq("status", status);
      if (busca) query = query.or(`fornecedor_nome.ilike.%${busca}%,numero_nf.ilike.%${busca}%`);

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar compras:", error);
        throw error;
      }

      return (data || []).map((c): Compra => ({
        id: c.id,
        empresa_id: c.empresa_id,
        numero: c.numero,
        fornecedor_nome: c.fornecedor_nome,
        fornecedor_cnpj: c.fornecedor_cnpj,
        data_pedido: c.data_pedido,
        data_previsao: c.data_previsao,
        valor_produtos: Number(c.valor_produtos) || 0,
        valor_frete: Number(c.valor_frete) || 0,
        valor_desconto: Number(c.valor_desconto) || 0,
        valor_total: Number(c.valor_total) || 0,
        numero_nf: c.numero_nf,
        chave_acesso: c.chave_acesso,
        data_nf: c.data_nf,
        status: c.status as StatusCompra,
        armazem_destino_id: c.armazem_destino_id,
        observacoes: c.observacoes,
        created_at: c.created_at,
        updated_at: c.updated_at,
        itens: (c.itens || []).map((i: any): CompraItem => ({
          id: i.id,
          compra_id: i.compra_id,
          produto_id: i.produto_id,
          codigo_nf: i.codigo_nf,
          descricao_nf: i.descricao_nf,
          ncm: i.ncm,
          cfop: i.cfop,
          quantidade: Number(i.quantidade) || 0,
          quantidade_recebida: Number(i.quantidade_recebida) || 0,
          valor_unitario: Number(i.valor_unitario) || 0,
          valor_total: Number(i.valor_total) || 0,
          aliquota_icms: i.aliquota_icms ? Number(i.aliquota_icms) : null,
          valor_icms: i.valor_icms ? Number(i.valor_icms) : null,
          aliquota_ipi: i.aliquota_ipi ? Number(i.aliquota_ipi) : null,
          valor_ipi: i.valor_ipi ? Number(i.valor_ipi) : null,
          mapeado: i.mapeado || false,
          created_at: i.created_at,
          updated_at: i.updated_at,
        })),
      }));
    },
  });

  // Criar compra
  const criarCompra = useMutation({
    mutationFn: async (input: CompraInsert & { itens?: Omit<CompraItem, 'id' | 'compra_id' | 'created_at' | 'updated_at'>[] }) => {
      const { itens, ...compraData } = input;
      
      // Calcular data de vencimento se a prazo
      let dataVencimento = compraData.data_vencimento;
      if (compraData.condicao_pagamento === 'a_prazo' && compraData.prazo_dias && !dataVencimento) {
        const dataBase = new Date(compraData.data_pedido);
        dataBase.setDate(dataBase.getDate() + compraData.prazo_dias);
        dataVencimento = dataBase.toISOString().split('T')[0];
      }
      
      const { data: compra, error: compraError } = await supabase
        .from("compras")
        .insert({
          empresa_id: compraData.empresa_id,
          numero: compraData.numero || null,
          fornecedor_nome: compraData.fornecedor_nome,
          fornecedor_cnpj: compraData.fornecedor_cnpj || null,
          data_pedido: compraData.data_pedido,
          data_previsao: compraData.data_previsao || null,
          valor_produtos: compraData.valor_produtos || 0,
          valor_frete: compraData.valor_frete || 0,
          valor_desconto: compraData.valor_desconto || 0,
          valor_total: compraData.valor_total || 0,
          numero_nf: compraData.numero_nf || null,
          chave_acesso: compraData.chave_acesso || null,
          data_nf: compraData.data_nf || null,
          status: compraData.status || 'rascunho',
          armazem_destino_id: compraData.armazem_destino_id || null,
          observacoes: compraData.observacoes || null,
          forma_pagamento: compraData.forma_pagamento || null,
          condicao_pagamento: compraData.condicao_pagamento || 'a_vista',
          prazo_dias: compraData.prazo_dias || null,
          data_vencimento: dataVencimento || null,
          gerar_conta_pagar: compraData.gerar_conta_pagar || false,
          // Novos campos para custo efetivo e ICMS
          valor_icms_st: compraData.valor_icms_st || 0,
          outras_despesas: compraData.outras_despesas || 0,
          uf_emitente: compraData.uf_emitente || null,
        })
        .select()
        .single();

      if (compraError) throw compraError;

      if (itens && itens.length > 0) {
        const itensParaInserir = itens.map(item => ({
          compra_id: compra.id,
          produto_id: item.produto_id || null,
          codigo_nf: item.codigo_nf || null,
          descricao_nf: item.descricao_nf,
          ncm: item.ncm || null,
          cfop: item.cfop || null,
          quantidade: item.quantidade,
          quantidade_recebida: 0,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          aliquota_icms: item.aliquota_icms || null,
          valor_icms: item.valor_icms || null,
          aliquota_ipi: item.aliquota_ipi || null,
          valor_ipi: item.valor_ipi || null,
          valor_icms_st: (item as any).valor_icms_st || 0,
          mapeado: item.mapeado || false,
        }));

        const { error: itensError } = await supabase
          .from("compras_itens")
          .insert(itensParaInserir);

        if (itensError) throw itensError;

        // Criar produtos rascunho para itens sem produto vinculado
        for (const item of itens) {
          if (!item.produto_id && item.descricao_nf) {
            // Verificar se já existe produto com mesmo SKU/código
            const skuRascunho = item.codigo_nf || `NF-${compra.numero_nf || compra.id.slice(0, 6)}-${Date.now().toString(36)}`;
            
            const { data: existente } = await supabase
              .from("produtos")
              .select("id")
              .eq("empresa_id", compra.empresa_id)
              .eq("sku", skuRascunho)
              .maybeSingle();

            if (!existente) {
              const { data: novoProduto, error: produtoError } = await supabase
                .from("produtos")
                .insert({
                  empresa_id: compra.empresa_id,
                  sku: skuRascunho,
                  nome: item.descricao_nf,
                  ncm: item.ncm || null,
                  cfop_compra: item.cfop || null,
                  custo_medio: item.valor_unitario,
                  fornecedor_nome: compraData.fornecedor_nome,
                  status: 'rascunho',
                  tipo: 'unico',
                  unidade_medida: 'un',
                })
                .select()
                .single();

              // Se criou o produto, vincular ao item da compra
              if (!produtoError && novoProduto) {
                const { data: itemInserido } = await supabase
                  .from("compras_itens")
                  .select("id")
                  .eq("compra_id", compra.id)
                  .eq("descricao_nf", item.descricao_nf)
                  .maybeSingle();

                if (itemInserido) {
                  await supabase
                    .from("compras_itens")
                    .update({ produto_id: novoProduto.id })
                    .eq("id", itemInserido.id);
                }
              }
            }
          }
        }
      }

      // Gerar conta a pagar automaticamente se solicitado (com suporte a parcelas)
      if (compraData.gerar_conta_pagar && compra.valor_total > 0) {
        const numParcelas = compraData.numero_parcelas || 1;
        const valorParcela = compra.valor_total / numParcelas;
        const dataBase = new Date(compraData.data_nf || compraData.data_pedido);
        const prazo = compraData.prazo_dias || 30;

        for (let i = 0; i < numParcelas; i++) {
          const dataVencimentoParcela = new Date(dataBase);
          dataVencimentoParcela.setDate(dataVencimentoParcela.getDate() + prazo * (i + 1));

          const descricaoParcela = numParcelas > 1 
            ? `Compra ${compra.numero_nf ? `NF ${compra.numero_nf}` : compra.numero || compra.id.slice(0, 8)} - Parcela ${i + 1}/${numParcelas}`
            : `Compra ${compra.numero_nf ? `NF ${compra.numero_nf}` : compra.numero || compra.id.slice(0, 8)}`;

          const { error: contaError } = await supabase
            .from("contas_a_pagar")
            .insert({
              empresa_id: compra.empresa_id,
              fornecedor_nome: compra.fornecedor_nome,
              descricao: descricaoParcela,
              documento: compra.numero_nf || compra.numero,
              valor_total: valorParcela,
              valor_em_aberto: valorParcela,
              data_emissao: compra.data_nf || compra.data_pedido,
              data_vencimento: dataVencimentoParcela.toISOString().split('T')[0],
              forma_pagamento: compra.forma_pagamento,
              status: 'em_analise',
              tipo_lancamento: 'compra_mercadoria',
              compra_id: compra.id,
              numero_parcela: numParcelas > 1 ? i + 1 : null,
              total_parcelas: numParcelas > 1 ? numParcelas : null,
            });

          if (contaError) {
            console.error("Erro ao criar conta a pagar (parcela):", contaError);
            // Não lança erro para não bloquear a compra
          }
        }
      }

      return compra;
    },
    onSuccess: () => {
      toast.success("Compra criada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["compras"] });
      queryClient.invalidateQueries({ queryKey: ["contas-a-pagar"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar compra:", error);
      toast.error(`Erro ao criar compra: ${error.message}`);
    },
  });

  // Atualizar status
  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusCompra }) => {
      const { error } = await supabase
        .from("compras")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });

  // Excluir compra
  const excluirCompra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compra excluída");
      queryClient.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    total: compras.length,
    rascunho: compras.filter(c => c.status === 'rascunho').length,
    emitido: compras.filter(c => c.status === 'emitido').length,
    em_transito: compras.filter(c => c.status === 'em_transito').length,
    parcial: compras.filter(c => c.status === 'parcial').length,
    concluido: compras.filter(c => c.status === 'concluido').length,
    cancelado: compras.filter(c => c.status === 'cancelado').length,
    valorTotal: compras.reduce((sum, c) => sum + c.valor_total, 0),
    itensNaoMapeados: compras.reduce((sum, c) => 
      sum + (c.itens?.filter(i => !i.mapeado).length || 0), 0),
  };

  return {
    compras,
    isLoading,
    refetch,
    resumo,
    criarCompra,
    atualizarStatus,
    excluirCompra,
  };
}

// ============= HOOK PARA RECEBIMENTOS =============

export function useRecebimentos(compraId: string | null) {
  const queryClient = useQueryClient();

  const { data: recebimentos = [], isLoading } = useQuery({
    queryKey: ["recebimentos", compraId],
    enabled: !!compraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos")
        .select(`
          *,
          itens:recebimentos_itens(*)
        `)
        .eq("compra_id", compraId)
        .order("data_recebimento", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Registrar recebimento
  const registrarRecebimento = useMutation({
    mutationFn: async (input: {
      compra_id: string;
      armazem_id: string;
      data_recebimento: string;
      observacoes?: string;
      forcar_conclusao?: boolean;
      valor_frete?: number;
      valor_produtos?: number;
      valor_icms_st?: number;
      outras_despesas?: number;
      valor_desconto?: number;
      uf_emitente?: string | null;
      itens: {
        compra_item_id: string;
        produto_id: string | null;
        quantidade_recebida: number;
        quantidade_devolvida?: number;
        custo_unitario: number;
        custo_efetivo?: number;
        valor_ipi?: number;
        valor_icms?: number;
        valor_icms_st?: number;
        aliquota_icms?: number;
        ncm?: string | null;
        cfop?: string | null;
        lote?: string;
        validade?: string;
        localizacao?: string;
        observacao?: string;
      }[];
    }) => {
      // Buscar dados da compra para contexto
      const { data: compraData } = await supabase
        .from("compras")
        .select("empresa_id, numero_nf, chave_acesso, data_nf, fornecedor_nome, fornecedor_cnpj, uf_emitente")
        .eq("id", input.compra_id)
        .single();

      if (!compraData) throw new Error("Compra não encontrada");

      // Criar registro de recebimento
      const { data: recebimento, error: recError } = await supabase
        .from("recebimentos")
        .insert({
          compra_id: input.compra_id,
          armazem_id: input.armazem_id,
          data_recebimento: input.data_recebimento,
          observacoes: input.observacoes || null,
        })
        .select()
        .single();

      if (recError) throw recError;

      // Inserir itens do recebimento (se houver)
      const itensParaInserir = input.itens
        .filter(item => item.quantidade_recebida > 0)
        .map(item => ({
          recebimento_id: recebimento.id,
          compra_item_id: item.compra_item_id,
          produto_id: item.produto_id || null, // Aceita null
          quantidade_recebida: item.quantidade_recebida,
          quantidade_devolvida: item.quantidade_devolvida || 0,
          custo_unitario: item.custo_efetivo || item.custo_unitario, // Usar custo efetivo
          lote: item.lote || null,
          validade: item.validade || null,
          localizacao: item.localizacao || null,
          observacao: item.observacao || null,
        }));

      if (itensParaInserir.length > 0) {
        const { error: itensError } = await supabase
          .from("recebimentos_itens")
          .insert(itensParaInserir);

        if (itensError) throw itensError;
        
        // Para cada item recebido, atualizar compra_itens E dar entrada no estoque
        for (const item of input.itens) {
          if (item.quantidade_recebida > 0) {
            // 1. Atualizar quantidade_recebida no item da compra
            const { data: itemCompra } = await supabase
              .from("compras_itens")
              .select("quantidade_recebida")
              .eq("id", item.compra_item_id)
              .single();
            
            const qtdAtual = Number(itemCompra?.quantidade_recebida) || 0;
            
            await supabase
              .from("compras_itens")
              .update({ quantidade_recebida: qtdAtual + item.quantidade_recebida })
              .eq("id", item.compra_item_id);

            // 2. Dar entrada no estoque (se produto vinculado E status NÃO é rascunho)
            if (item.produto_id) {
              // Verificar se produto está com status 'rascunho' (pendente de cadastro)
              const { data: produtoData } = await supabase
                .from("produtos")
                .select("status")
                .eq("id", item.produto_id)
                .single();
              
              // Se produto está em rascunho, NÃO dar entrada no estoque
              if (produtoData?.status === 'rascunho') {
                console.log(`Produto ${item.produto_id} está como rascunho. Entrada no estoque bloqueada até ativação.`);
                continue; // Pula para próximo item sem dar entrada no estoque
              }

              const custoUnitario = item.custo_efetivo || item.custo_unitario;
              
              // Buscar estoque atual
              const { data: estoqueAtual } = await supabase
                .from("estoque")
                .select("*")
                .eq("produto_id", item.produto_id)
                .eq("armazem_id", input.armazem_id)
                .maybeSingle();
              
              const qtdAnterior = Number(estoqueAtual?.quantidade) || 0;
              const custoMedioAnterior = Number(estoqueAtual?.custo_medio) || 0;
              const qtdNova = qtdAnterior + item.quantidade_recebida;
              
              // Calcular custo médio ponderado
              const valorAnterior = qtdAnterior * custoMedioAnterior;
              const valorEntrada = item.quantidade_recebida * custoUnitario;
              const novoCustoMedio = qtdNova > 0 ? (valorAnterior + valorEntrada) / qtdNova : custoUnitario;
              
              // Upsert estoque
              if (estoqueAtual) {
                await supabase
                  .from("estoque")
                  .update({
                    quantidade: qtdNova,
                    custo_medio: novoCustoMedio,
                  })
                  .eq("id", estoqueAtual.id);
              } else {
                await supabase
                  .from("estoque")
                  .insert({
                    empresa_id: compraData.empresa_id,
                    produto_id: item.produto_id,
                    armazem_id: input.armazem_id,
                    quantidade: qtdNova,
                    custo_medio: novoCustoMedio,
                  });
              }
              
              // Registrar movimentação de estoque
              await supabase.from("movimentacoes_estoque").insert({
                empresa_id: compraData.empresa_id,
                produto_id: item.produto_id,
                armazem_id: input.armazem_id,
                tipo: 'entrada',
                motivo: 'Recebimento de Compra',
                origem: 'compra',
                quantidade: item.quantidade_recebida,
                custo_unitario: custoUnitario,
                custo_total: item.quantidade_recebida * custoUnitario,
                estoque_anterior: qtdAnterior,
                estoque_posterior: qtdNova,
                custo_medio_anterior: custoMedioAnterior,
                custo_medio_posterior: novoCustoMedio,
                documento: compraData.numero_nf || null,
                referencia_id: recebimento.id,
              });

              // Atualizar custo_medio no produto
              await supabase
                .from("produtos")
                .update({ custo_medio: novoCustoMedio })
                .eq("id", item.produto_id);
            }

            // 3. Registrar crédito de ICMS (se ICMS destacado > 0)
            if (item.valor_icms && item.valor_icms > 0) {
              const valorIcmsRecebido = (item.valor_icms / (item.quantidade_recebida + (item.quantidade_devolvida || 0))) * item.quantidade_recebida;
              const competencia = input.data_recebimento.substring(0, 7); // YYYY-MM
              
              await supabase.from("creditos_icms").insert({
                empresa_id: compraData.empresa_id,
                tipo_credito: 'compensavel', // TODO: determinar baseado no regime da empresa
                origem_credito: 'compra_mercadoria',
                status_credito: 'ativo',
                chave_acesso: compraData.chave_acesso || null,
                numero_nf: compraData.numero_nf || null,
                ncm: item.ncm || '00000000',
                descricao: `Recebimento - Item ${item.compra_item_id.slice(0, 8)}`,
                quantidade: item.quantidade_recebida,
                valor_unitario: item.custo_unitario,
                valor_total: item.quantidade_recebida * item.custo_unitario,
                uf_origem: input.uf_emitente || (compraData as any).uf_emitente || null,
                cfop: item.cfop || null,
                aliquota_icms: item.aliquota_icms || 0,
                valor_icms_destacado: valorIcmsRecebido,
                percentual_aproveitamento: 100,
                valor_credito_bruto: valorIcmsRecebido,
                valor_credito: valorIcmsRecebido,
                data_lancamento: input.data_recebimento,
                data_competencia: competencia,
                fornecedor_nome: compraData.fornecedor_nome,
              });
            }
          }
        }
      }

      return { 
        recebimento, 
        forcar_conclusao: input.forcar_conclusao,
        compraData,
        itens: input.itens,
        uf_emitente: input.uf_emitente,
      };
    },
    onSuccess: async (result, variables) => {
      const { forcar_conclusao } = result;
      
      // Atualizar status da compra automaticamente baseado no recebimento
      try {
        // Se forçar conclusão, vai direto para concluído
        if (forcar_conclusao) {
          await supabase
            .from("compras")
            .update({ status: 'concluido' })
            .eq("id", variables.compra_id);
          
          toast.success("Pedido encerrado manualmente como concluído");
        } else {
          // Buscar compra atualizada (depois de atualizar os itens)
          const { data: compra } = await supabase
            .from("compras")
            .select(`*, itens:compras_itens(*)`)
            .eq("id", variables.compra_id)
            .single();
          
          if (compra) {
            const totalPedido = compra.itens.reduce((sum: number, i: any) => sum + Number(i.quantidade), 0);
            const totalRecebido = compra.itens.reduce((sum: number, i: any) => sum + Number(i.quantidade_recebida), 0);
            
            console.log("Status check:", { totalPedido, totalRecebido, currentStatus: compra.status });
            
            // Determinar novo status
            let novoStatus: StatusCompra = compra.status as StatusCompra;
            if (totalRecebido >= totalPedido) {
              novoStatus = 'concluido';
            } else if (totalRecebido > 0) {
              novoStatus = 'parcial';
            }
            
            // Atualizar status se mudou
            if (novoStatus !== compra.status) {
              await supabase
                .from("compras")
                .update({ status: novoStatus })
                .eq("id", variables.compra_id);
            }
          }
          
          toast.success("Recebimento registrado com sucesso");
        }
      } catch (err) {
        console.error("Erro ao atualizar status após recebimento:", err);
      }
      
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      queryClient.invalidateQueries({ queryKey: ["compras"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar recebimento:", error);
      toast.error(`Erro ao registrar recebimento: ${error.message}`);
    },
  });

  return {
    recebimentos,
    isLoading,
    registrarRecebimento,
  };
}
