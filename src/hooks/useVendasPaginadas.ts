import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";

/**
 * Tipo para transações paginadas (sem itens - carregados sob demanda)
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
  // Campos calculados
  nao_conciliado: boolean;
  qtd_itens: number;
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
}

/**
 * Hook otimizado para buscar vendas com paginação real no servidor.
 * Não traz itens junto - use useVendaItens para carregar sob demanda.
 */
export function useVendasPaginadas({
  page = 0,
  pageSize = 50,
  periodoInicio,
  periodoFim,
  canal,
  conta,
  statusVenda,
}: UseVendasPaginadasParams) {
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaId = empresaAtiva?.id;

  // Buscar resumo agregado via RPC (uma chamada para todas as métricas)
  const { data: resumoAgregado, isLoading: isLoadingResumo } = useQuery({
    queryKey: ["vendas-resumo-agregado", empresaId, periodoInicio, periodoFim],
    queryFn: async () => {
      if (!empresaId) return null;

      // Converter datas para UTC
      const dataInicioUTC = `${periodoInicio}T03:00:00.000Z`;
      const dataFimDate = new Date(`${periodoFim}T03:00:00.000Z`);
      dataFimDate.setDate(dataFimDate.getDate() + 1);
      const dataFimUTC = dataFimDate.toISOString();

      const { data, error } = await supabase.rpc("get_vendas_resumo", {
        p_empresa_id: empresaId,
        p_data_inicio: dataInicioUTC,
        p_data_fim: dataFimUTC,
      });

      if (error) {
        console.error("Erro ao buscar resumo de vendas:", error);
        return null;
      }

      // RPC retorna array com 1 registro
      const resultado = Array.isArray(data) ? data[0] : data;
      return resultado as ResumoVendasAgregado | null;
    },
    enabled: !!empresaId,
    staleTime: 30 * 1000, // Cache por 30 segundos
  });

  // Buscar transações paginadas (sem itens)
  const { 
    data: transacoesData, 
    isLoading: isLoadingTransacoes,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: [
      "vendas-paginadas",
      empresaId,
      periodoInicio,
      periodoFim,
      canal,
      conta,
      statusVenda,
      page,
      pageSize,
    ],
    queryFn: async () => {
      if (!empresaId) return { transacoes: [], totalRegistros: 0 };

      // Converter datas para UTC
      const dataInicioUTC = `${periodoInicio}T03:00:00.000Z`;
      const dataFimDate = new Date(`${periodoFim}T03:00:00.000Z`);
      dataFimDate.setDate(dataFimDate.getDate() + 1);
      const dataFimUTC = dataFimDate.toISOString();

      let query = supabase
        .from("marketplace_transactions")
        .select("*, marketplace_transaction_items(id)", { count: "exact" })
        .eq("empresa_id", empresaId)
        .eq("tipo_lancamento", "credito")
        .gte("data_transacao", dataInicioUTC)
        .lt("data_transacao", dataFimUTC)
        .order("data_transacao", { ascending: false })
        .order("id", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Aplicar filtros opcionais
      if (canal && canal !== "todos") {
        query = query.eq("canal", canal);
      }
      if (conta) {
        query = query.ilike("conta_nome", `%${conta}%`);
      }
      if (statusVenda && statusVenda !== "todos") {
        query = query.eq("status", statusVenda);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Erro ao buscar vendas paginadas:", error);
        throw error;
      }

      // Transformar dados
      const transacoes: TransacaoPaginada[] = (data || []).map((t: any) => {
        const temDadosFinanceiros =
          (t.tarifas || 0) !== 0 ||
          (t.taxas || 0) !== 0 ||
          (t.frete_vendedor || 0) !== 0 ||
          (t.custo_ads || 0) !== 0;

        return {
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
          valor_bruto: t.valor_bruto || 0,
          valor_liquido: t.valor_liquido || 0,
          tarifas: t.tarifas || 0,
          taxas: t.taxas || 0,
          outros_descontos: t.outros_descontos || 0,
          tipo_lancamento: t.tipo_lancamento,
          categoria_id: t.categoria_id,
          centro_custo_id: t.centro_custo_id,
          tipo_envio: t.tipo_envio,
          frete_comprador: t.frete_comprador || 0,
          frete_vendedor: t.frete_vendedor || 0,
          custo_ads: t.custo_ads || 0,
          nao_conciliado: !temDadosFinanceiros && t.status !== "conciliado",
          qtd_itens: t.marketplace_transaction_items?.length || 0,
        };
      });

      return {
        transacoes,
        totalRegistros: count || 0,
      };
    },
    enabled: !!empresaId,
    refetchInterval: 60 * 1000, // Auto-refresh a cada 1 minuto
    refetchIntervalInBackground: false,
  });

  const transacoes = transacoesData?.transacoes || [];
  const totalRegistros = transacoesData?.totalRegistros || 0;
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
