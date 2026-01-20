import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Representa um pedido agregado (1 linha por pedido)
 * Consolida todos os eventos de um pedido em uma única estrutura
 */
export interface PedidoAgregado {
  pedido_id: string;
  empresa_id: string;
  canal: string;
  conta_nome: string | null;
  data_pedido: string;
  data_repasse: string | null;
  status: string;
  tipo_envio: string | null;
  // Valores financeiros
  valor_produto: number;
  comissao_total: number;      // taxas (CV - comissão de venda)
  tarifa_fixa_total: number;   // tarifas (FINANCING_FEE, etc)
  frete_vendedor_total: number; // CXE
  ads_total: number;
  impostos_total: number;
  outros_descontos_total: number;
  valor_liquido_calculado: number;
  // CMV e margem
  qtd_itens: number;
  cmv_total: number;
  margem_contribuicao: number;
}

/**
 * Resumo agregado de todos os pedidos no período
 */
export interface ResumoPedidosAgregado {
  total_pedidos: number;
  total_itens: number;
  valor_produto_total: number;
  comissao_total: number;
  tarifa_fixa_total: number;
  frete_vendedor_total: number;
  ads_total: number;
  impostos_total: number;
  valor_liquido_total: number;
  cmv_total: number;
  margem_contribuicao_total: number;
}

interface UseVendasPorPedidoParams {
  page?: number;
  pageSize?: number;
  periodoInicio: string;
  periodoFim: string;
  canal?: string;
  conta?: string;
  statusVenda?: string;
  empresaId?: string | null;
}

/**
 * Hook para buscar vendas agregadas por pedido (1 linha por pedido)
 * Usa as RPCs: get_vendas_por_pedido, get_vendas_por_pedido_count, get_vendas_por_pedido_resumo
 */
export function useVendasPorPedido({
  page = 0,
  pageSize = 50,
  periodoInicio,
  periodoFim,
  canal,
  conta,
  statusVenda,
  empresaId,
}: UseVendasPorPedidoParams) {
  const empresaParam = empresaId && empresaId !== "todas" ? empresaId : null;

  // PADRONIZADO: Envia strings DATE (YYYY-MM-DD) diretamente
  // A RPC converte para TIMESTAMPTZ usando date_to_br_timestamptz internamente
  // Isso garante consistência com Dashboard e outras telas

  // Buscar resumo agregado via RPC
  const { data: resumoAgregado, isLoading: isLoadingResumo } = useQuery({
    queryKey: ["vendas-por-pedido-resumo", empresaParam, periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_vendas_por_pedido_resumo", {
        p_empresa_id: empresaParam,
        p_data_inicio: periodoInicio,
        p_data_fim: periodoFim,
      });

      if (error) {
        console.error("Erro ao buscar resumo de pedidos:", error);
        return null;
      }

      const resultado = Array.isArray(data) ? data[0] : data;
      if (!resultado) return null;

      return {
        total_pedidos: Number(resultado.total_pedidos) || 0,
        total_itens: Number(resultado.total_itens) || 0,
        valor_produto_total: Number(resultado.valor_produto_total) || 0,
        comissao_total: Number(resultado.comissao_total) || 0,
        tarifa_fixa_total: Number(resultado.tarifa_fixa_total) || 0,
        frete_vendedor_total: Number(resultado.frete_vendedor_total) || 0,
        ads_total: Number(resultado.ads_total) || 0,
        impostos_total: Number(resultado.impostos_total) || 0,
        valor_liquido_total: Number(resultado.valor_liquido_total) || 0,
        cmv_total: Number(resultado.cmv_total) || 0,
        margem_contribuicao_total: Number(resultado.margem_contribuicao_total) || 0,
      } as ResumoPedidosAgregado;
    },
    staleTime: 30 * 1000,
  });

  // Buscar contagem total via RPC separada
  const { data: totalCount } = useQuery({
    queryKey: [
      "vendas-por-pedido-count",
      empresaParam,
      periodoInicio,
      periodoFim,
      canal,
      conta,
      statusVenda,
    ],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_vendas_por_pedido_count", {
        p_empresa_id: empresaParam,
        p_data_inicio: periodoInicio,
        p_data_fim: periodoFim,
        p_canal: canal || null,
        p_conta: conta || null,
        p_status: statusVenda || null,
      });

      if (error) {
        console.error("Erro ao buscar contagem de pedidos:", error);
        return 0;
      }

      return Number(data) || 0;
    },
    staleTime: 60 * 1000,
  });

  // Buscar pedidos paginados
  const {
    data: pedidosData,
    isLoading: isLoadingPedidos,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: [
      "vendas-por-pedido",
      empresaParam,
      periodoInicio,
      periodoFim,
      canal,
      conta,
      statusVenda,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_vendas_por_pedido", {
        p_empresa_id: empresaParam,
        p_data_inicio: periodoInicio,
        p_data_fim: periodoFim,
        p_canal: canal || null,
        p_conta: conta || null,
        p_status: statusVenda || null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });

      if (error) {
        console.error("Erro ao buscar pedidos paginados:", error);
        throw error;
      }

      const pedidos: PedidoAgregado[] = (data || []).map((p: any) => ({
        pedido_id: p.pedido_id,
        empresa_id: p.empresa_id,
        canal: p.canal,
        conta_nome: p.conta_nome,
        data_pedido: p.data_pedido,
        data_repasse: p.data_repasse,
        status: p.status,
        tipo_envio: p.tipo_envio,
        valor_produto: Number(p.valor_produto) || 0,
        comissao_total: Number(p.comissao_total) || 0,
        tarifa_fixa_total: Number(p.tarifa_fixa_total) || 0,
        frete_vendedor_total: Number(p.frete_vendedor_total) || 0,
        ads_total: Number(p.ads_total) || 0,
        impostos_total: Number(p.impostos_total) || 0,
        outros_descontos_total: Number(p.outros_descontos_total) || 0,
        valor_liquido_calculado: Number(p.valor_liquido_calculado) || 0,
        qtd_itens: Number(p.qtd_itens) || 0,
        cmv_total: Number(p.cmv_total) || 0,
        margem_contribuicao: Number(p.margem_contribuicao) || 0,
      }));

      return pedidos;
    },
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const pedidos = pedidosData || [];
  const totalRegistros = totalCount || 0;
  const totalPaginas = Math.ceil(totalRegistros / pageSize);

  // Extrair canais e contas disponíveis para filtros
  const { canaisDisponiveis, contasDisponiveis } = useMemo(() => {
    const canais = new Set<string>();
    const contas = new Set<string>();

    pedidos.forEach((p) => {
      if (p.canal) canais.add(p.canal);
      if (p.conta_nome) contas.add(p.conta_nome);
    });

    return {
      canaisDisponiveis: Array.from(canais),
      contasDisponiveis: Array.from(contas),
    };
  }, [pedidos]);

  return {
    pedidos,
    totalRegistros,
    totalPaginas,
    currentPage: page,
    pageSize,
    resumoAgregado,
    canaisDisponiveis,
    contasDisponiveis,
    isLoading: isLoadingPedidos || isLoadingResumo,
    isFetching,
    dataUpdatedAt,
    refetch,
  };
}
