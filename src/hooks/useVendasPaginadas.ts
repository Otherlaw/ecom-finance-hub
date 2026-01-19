import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipo para transações paginadas com CMV agregado
 */
export interface TransacaoPaginada {
  id: string;
  empresa_id: string;
  canal: string;
  canal_venda: string | null;
  conta_nome: string | null;
  pedido_id: string | null;
  data_transacao: string;
  data_repasse: string | null;
  tipo_transacao: string;
  descricao: string;
  status: string;
  referencia_externa: string | null;
  valor_bruto: number;
  valor_liquido: number;
  tarifas: number;
  taxas: number;
  outros_descontos: number;
  tipo_lancamento: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  tipo_envio: string | null;
  frete_comprador: number;
  frete_vendedor: number;
  custo_ads: number;
  // Campos calculados pela RPC
  nao_conciliado: boolean;
  qtd_itens: number;
  cmv_total: number; // CMV calculado via RPC
}

export interface ResumoVendasAgregado {
  total_bruto: number;
  total_liquido: number;
  total_tarifas: number;
  total_taxas: number;
  total_frete_comprador: number;
  total_frete_vendedor: number;
  total_custo_ads: number;
  total_transacoes: number;
  transacoes_sem_categoria: number;
  transacoes_nao_conciliadas: number;
}

interface UseVendasPaginadasParams {
  page?: number;
  pageSize?: number;
  periodoInicio: string;
  periodoFim: string;
  canal?: string;
  conta?: string;
  statusVenda?: string;
  /** ID da empresa ou undefined/null para todas */
  empresaId?: string | null;
}

/**
 * Hook otimizado para buscar vendas com paginação real no servidor.
 * Usa RPCs otimizadas para performance e inclui CMV calculado.
 */
export function useVendasPaginadas({
  page = 0,
  pageSize = 50,
  periodoInicio,
  periodoFim,
  canal,
  conta,
  statusVenda,
  empresaId,
}: UseVendasPaginadasParams) {
  // Passa null para RPC quando empresaId é undefined/"todas" para buscar todas
  const empresaParam = empresaId && empresaId !== "todas" ? empresaId : null;

  // Converter datas para UTC com ajuste BR (meia-noite BR = 03:00 UTC)
  const dataInicioUTC = `${periodoInicio}T03:00:00.000Z`;
  const dataFimDate = new Date(`${periodoFim}T03:00:00.000Z`);
  dataFimDate.setDate(dataFimDate.getDate() + 1);
  const dataFimUTC = dataFimDate.toISOString();

  // Buscar resumo agregado via RPC (uma chamada para todas as métricas)
  const { data: resumoAgregado, isLoading: isLoadingResumo } = useQuery({
    queryKey: ["vendas-resumo-agregado", empresaParam, periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendas_resumo", {
        p_empresa_id: empresaParam,
        p_data_inicio: dataInicioUTC,
        p_data_fim: dataFimUTC,
      });

      if (error) {
        console.error("Erro ao buscar resumo de vendas:", error);
        return null;
      }

      const resultado = Array.isArray(data) ? data[0] : data;
      return resultado as ResumoVendasAgregado | null;
    },
    staleTime: 30 * 1000,
  });

  // Buscar contagem total via RPC separada (mais performático que count: exact)
  const { data: totalCount } = useQuery({
    queryKey: [
      "vendas-count",
      empresaParam,
      periodoInicio,
      periodoFim,
      canal,
      statusVenda,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendas_count", {
        p_empresa_id: empresaParam,
        p_data_inicio: dataInicioUTC,
        p_data_fim: dataFimUTC,
        p_canal: canal || null,
        p_status: statusVenda || null,
      });

      if (error) {
        console.error("Erro ao buscar contagem de vendas:", error);
        return 0;
      }

      return data as number;
    },
    staleTime: 60 * 1000, // Cache contagem por 1 minuto
  });

  // Buscar transações paginadas COM CMV via RPC otimizada
  const { 
    data: transacoesData, 
    isLoading: isLoadingTransacoes,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: [
      "vendas-paginadas-cmv",
      empresaParam,
      periodoInicio,
      periodoFim,
      canal,
      statusVenda,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendas_com_cmv", {
        p_empresa_id: empresaParam,
        p_data_inicio: dataInicioUTC,
        p_data_fim: dataFimUTC,
        p_canal: canal || null,
        p_status: statusVenda || null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });

      if (error) {
        console.error("Erro ao buscar vendas paginadas:", error);
        throw error;
      }

      // Transformar dados da RPC
      const transacoes: TransacaoPaginada[] = (data || []).map((t: any) => ({
        id: t.id,
        empresa_id: t.empresa_id,
        canal: t.canal,
        canal_venda: t.canal_venda,
        conta_nome: t.conta_nome,
        pedido_id: t.pedido_id,
        data_transacao: t.data_transacao,
        data_repasse: t.data_repasse,
        tipo_transacao: t.tipo_transacao,
        descricao: t.descricao,
        status: t.status,
        referencia_externa: t.referencia_externa,
        valor_bruto: Number(t.valor_bruto) || 0,
        valor_liquido: Number(t.valor_liquido) || 0,
        tarifas: Number(t.tarifas) || 0,
        taxas: Number(t.taxas) || 0,
        outros_descontos: Number(t.outros_descontos) || 0,
        tipo_lancamento: t.tipo_lancamento,
        categoria_id: t.categoria_id,
        centro_custo_id: t.centro_custo_id,
        tipo_envio: t.tipo_envio,
        frete_comprador: Number(t.frete_comprador) || 0,
        frete_vendedor: Number(t.frete_vendedor) || 0,
        custo_ads: Number(t.custo_ads) || 0,
        nao_conciliado: t.nao_conciliado || false,
        qtd_itens: Number(t.qtd_itens) || 0,
        cmv_total: Number(t.cmv_total) || 0,
      }));

      return transacoes;
    },
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const transacoes = transacoesData || [];
  const totalRegistros = totalCount || 0;
  const totalPaginas = Math.ceil(totalRegistros / pageSize);

  // Extrair canais e contas disponíveis para filtros
  const { canaisDisponiveis, contasDisponiveis } = useMemo(() => {
    const canais = new Set<string>();
    const contas = new Set<string>();

    transacoes.forEach((t) => {
      if (t.canal) canais.add(t.canal);
      if (t.conta_nome) contas.add(t.conta_nome);
    });

    return {
      canaisDisponiveis: Array.from(canais),
      contasDisponiveis: Array.from(contas),
    };
  }, [transacoes]);

  return {
    transacoes,
    totalRegistros,
    totalPaginas,
    currentPage: page,
    pageSize,
    resumoAgregado,
    canaisDisponiveis,
    contasDisponiveis,
    isLoading: isLoadingTransacoes || isLoadingResumo,
    isFetching,
    dataUpdatedAt,
    refetch,
  };
}
