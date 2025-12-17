import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/useEmpresas";

export type StatusVenda = "todos" | "conciliado" | "pendente" | "importado" | "ignorado";

export interface VendasFiltros {
  dataInicio: string;
  dataFim: string;
  titulo?: string;
  sku?: string;
  pedidoId?: string;
  canal?: string;
  conta?: string;
  statusVenda?: StatusVenda;
  tipoEnvio?: string;
  teveAds?: "todos" | "com" | "sem";
  considerarFreteComprador?: boolean;
  somenteComDivergencia?: boolean;
  somenteNaoConciliadas?: boolean;
  somenteSemCusto?: boolean;
  somenteSemProduto?: boolean;
}

export interface VendaDetalhada {
  transacao_id: string;
  item_id: string | null;
  empresa_id: string;
  canal: string;
  canal_venda: string | null;
  conta_nome: string | null;
  pedido_id: string | null;
  data_venda: string;
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
  sku_marketplace: string | null;
  anuncio_id: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  produto_id: string | null;
  sku_interno: string | null;
  produto_nome: string | null;
  custo_medio: number;
  cmv_total: number | null;
  cmv_margem_bruta: number | null;
  cmv_margem_percentual: number | null;
  custo_calculado: number;
  sem_produto_vinculado: boolean;
  sem_custo: boolean;
  sem_categoria: boolean;
  nao_conciliado: boolean;
  categoria_id: string | null;
  centro_custo_id: string | null;
  // Novos campos de frete e ADS
  frete_comprador: number;
  frete_vendedor: number;
  custo_ads: number;
  tipo_envio: string | null;
}

export interface ResumoVendas {
  totalFaturamentoBruto: number;
  totalFaturamentoLiquido: number;
  totalCMV: number;
  totalTarifas: number;
  totalTaxas: number;
  totalOutrosDescontos: number;
  totalFreteComprador: number;
  totalFreteVendedor: number;
  totalCustoAds: number;
  totalImpostoVenda: number;
  margemContribuicao: number;
  margemContribuicaoPercent: number;
  ticketMedio: number;
  qtdTransacoes: number;
  qtdItens: number;
}

export interface ConsistenciaVendas {
  totalSemCusto: number;
  totalSemProduto: number;
  totalNaoConciliadas: number;
  totalSemCategoria: number;
}

function aplicarFiltrosLocais(
  dados: VendaDetalhada[],
  filtros: VendasFiltros
): VendaDetalhada[] {
  let result = [...dados];

  if (filtros.titulo) {
    const term = filtros.titulo.toLowerCase();
    result = result.filter((v) =>
      v.descricao?.toLowerCase().includes(term) ||
      v.descricao_item?.toLowerCase().includes(term) ||
      v.produto_nome?.toLowerCase().includes(term)
    );
  }

  if (filtros.sku) {
    const term = filtros.sku.toLowerCase();
    result = result.filter((v) =>
      v.sku_interno?.toLowerCase().includes(term) ||
      v.sku_marketplace?.toLowerCase().includes(term)
    );
  }

  if (filtros.pedidoId) {
    result = result.filter((v) =>
      v.pedido_id?.includes(filtros.pedidoId!) ||
      v.referencia_externa?.includes(filtros.pedidoId!)
    );
  }

  if (filtros.canal && filtros.canal !== "todos") {
    result = result.filter((v) => v.canal === filtros.canal);
  }

  if (filtros.conta) {
    const term = filtros.conta.toLowerCase();
    result = result.filter((v) =>
      v.conta_nome?.toLowerCase().includes(term)
    );
  }

  if (filtros.statusVenda && filtros.statusVenda !== "todos") {
    result = result.filter((v) => v.status === filtros.statusVenda);
  }

  if (filtros.somenteNaoConciliadas) {
    result = result.filter((v) => v.nao_conciliado);
  }

  if (filtros.somenteSemCusto) {
    result = result.filter((v) => v.sem_custo);
  }

  if (filtros.somenteSemProduto) {
    result = result.filter((v) => v.sem_produto_vinculado);
  }

  // Filtro por tipo de envio
  if (filtros.tipoEnvio && filtros.tipoEnvio !== "todos") {
    result = result.filter((v) => v.tipo_envio === filtros.tipoEnvio);
  }

  // Filtro por ADS
  if (filtros.teveAds && filtros.teveAds !== "todos") {
    if (filtros.teveAds === "com") {
      result = result.filter((v) => v.custo_ads > 0);
    } else {
      result = result.filter((v) => !v.custo_ads || v.custo_ads === 0);
    }
  }

  return result;
}

function calcularResumo(vendas: VendaDetalhada[], aliquotaImposto: number = 0): ResumoVendas {
  let totalFaturamentoBruto = 0;
  let totalFaturamentoLiquido = 0;
  let totalCMV = 0;
  let totalTarifas = 0;
  let totalTaxas = 0;
  let totalOutrosDescontos = 0;
  let totalFreteComprador = 0;
  let totalFreteVendedor = 0;
  let totalCustoAds = 0;
  let qtdItens = 0;

  const transacoesUnicas = new Set<string>();

  vendas.forEach((v) => {
    totalFaturamentoBruto += v.valor_bruto;
    totalFaturamentoLiquido += v.valor_liquido;
    totalCMV += v.cmv_total || v.custo_calculado || 0;
    totalTarifas += v.tarifas;
    totalTaxas += v.taxas;
    totalOutrosDescontos += v.outros_descontos;
    totalFreteComprador += (v as any).frete_comprador || 0;
    totalFreteVendedor += (v as any).frete_vendedor || 0;
    totalCustoAds += (v as any).custo_ads || 0;
    qtdItens += v.quantidade;
    transacoesUnicas.add(v.transacao_id);
  });

  const qtdTransacoes = transacoesUnicas.size;
  const totalImpostoVenda = totalFaturamentoBruto * (aliquotaImposto / 100);
  const margemContribuicao = totalFaturamentoLiquido - totalCMV - totalImpostoVenda - totalFreteVendedor - totalCustoAds;
  const margemContribuicaoPercent =
    totalFaturamentoBruto > 0 ? (margemContribuicao / totalFaturamentoBruto) * 100 : 0;
  const ticketMedio = qtdTransacoes > 0 ? totalFaturamentoBruto / qtdTransacoes : 0;

  return {
    totalFaturamentoBruto,
    totalFaturamentoLiquido,
    totalCMV,
    totalTarifas,
    totalTaxas,
    totalOutrosDescontos,
    totalFreteComprador,
    totalFreteVendedor,
    totalCustoAds,
    totalImpostoVenda,
    margemContribuicao,
    margemContribuicaoPercent,
    ticketMedio,
    qtdTransacoes,
    qtdItens,
  };
}

function calcularConsistencia(vendas: VendaDetalhada[]): ConsistenciaVendas {
  const totalSemCusto = vendas.filter((v) => v.sem_custo).length;
  const totalSemProduto = vendas.filter((v) => v.sem_produto_vinculado).length;
  const totalNaoConciliadas = vendas.filter((v) => v.nao_conciliado).length;
  const totalSemCategoria = vendas.filter((v) => v.sem_categoria).length;

  return {
    totalSemCusto,
    totalSemProduto,
    totalNaoConciliadas,
    totalSemCategoria,
  };
}

export function useVendas(filtros: VendasFiltros) {
  const { empresas } = useEmpresas();
  const empresaAtiva = empresas?.[0]; // Primeira empresa como padrão

  // Buscar config fiscal da empresa
  const { data: configFiscal } = useQuery({
    queryKey: ["empresa-config-fiscal", empresaAtiva?.id],
    queryFn: async () => {
      if (!empresaAtiva?.id) return null;
      const { data, error } = await supabase
        .from("empresas_config_fiscal")
        .select("aliquota_imposto_vendas")
        .eq("empresa_id", empresaAtiva.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaAtiva?.id,
  });

  const aliquotaImposto = configFiscal?.aliquota_imposto_vendas || 6; // Default 6% (Simples)

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["vendas", filtros, empresaAtiva?.id],
    queryFn: async () => {
      if (!empresaAtiva?.id) return [];

      // Converter datas do Brasil (UTC-3) para UTC
      // Meia-noite no Brasil = 03:00 UTC do mesmo dia
      // Fim do dia no Brasil (23:59:59) = 02:59:59 UTC do próximo dia
      const dataInicioUTC = `${filtros.dataInicio}T03:00:00.000Z`;
      const dataFimDate = new Date(`${filtros.dataFim}T03:00:00.000Z`);
      dataFimDate.setDate(dataFimDate.getDate() + 1);
      dataFimDate.setMilliseconds(dataFimDate.getMilliseconds() - 1);
      const dataFimUTC = dataFimDate.toISOString();

      // Query direta nas tabelas já que a view pode não existir ainda
      const { data: transacoes, error } = await supabase
        .from("marketplace_transactions")
        .select(`
          id,
          empresa_id,
          canal,
          canal_venda,
          conta_nome,
          pedido_id,
          data_transacao,
          data_repasse,
          tipo_transacao,
          descricao,
          status,
          referencia_externa,
          valor_bruto,
          valor_liquido,
          tarifas,
          taxas,
          outros_descontos,
          tipo_lancamento,
          categoria_id,
          centro_custo_id,
          tipo_envio,
          frete_comprador,
          frete_vendedor,
          custo_ads,
          marketplace_transaction_items (
            id,
            sku_marketplace,
            anuncio_id,
            descricao_item,
            quantidade,
            preco_unitario,
            preco_total,
            produto_id,
            produtos:produto_id (
              sku,
              nome,
              custo_medio
            )
          )
        `)
        .eq("empresa_id", empresaAtiva.id)
        .eq("tipo_lancamento", "credito")
        .gte("data_transacao", dataInicioUTC)
        .lt("data_transacao", dataFimUTC)
        .order("data_transacao", { ascending: false });

      if (error) throw error;

      // Transformar dados para o formato esperado
      const vendas: VendaDetalhada[] = [];

      (transacoes || []).forEach((t: any) => {
        const items = t.marketplace_transaction_items || [];
        
        // Critério para "não conciliado": não tem dados financeiros relevantes
        // (sem tarifas, sem taxas, sem frete vendedor e sem ads)
        const temDadosFinanceiros = 
          (t.tarifas || 0) !== 0 ||
          (t.taxas || 0) !== 0 ||
          (t.frete_vendedor || 0) !== 0 ||
          (t.custo_ads || 0) !== 0;
        
        const naoConciliado = !temDadosFinanceiros && t.status !== "conciliado";
        
        if (items.length === 0) {
          // Transação sem itens
          vendas.push({
            transacao_id: t.id,
            item_id: null,
            empresa_id: t.empresa_id,
            canal: t.canal,
            canal_venda: t.canal_venda,
            conta_nome: t.conta_nome,
            pedido_id: t.pedido_id,
            data_venda: t.data_transacao,
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
            sku_marketplace: null,
            anuncio_id: null,
            descricao_item: null,
            quantidade: 1,
            preco_unitario: t.valor_bruto || 0,
            preco_total: t.valor_bruto || 0,
            produto_id: null,
            sku_interno: null,
            produto_nome: null,
            custo_medio: 0,
            cmv_total: null,
            cmv_margem_bruta: null,
            cmv_margem_percentual: null,
            custo_calculado: 0,
            sem_produto_vinculado: true,
            sem_custo: true,
            sem_categoria: !t.categoria_id,
            nao_conciliado: naoConciliado,
            categoria_id: t.categoria_id,
            centro_custo_id: t.centro_custo_id,
            frete_comprador: t.frete_comprador || 0,
            frete_vendedor: t.frete_vendedor || 0,
            custo_ads: t.custo_ads || 0,
            tipo_envio: t.tipo_envio,
          } as VendaDetalhada);
        } else {
          // Uma linha para cada item
          items.forEach((item: any) => {
            const produto = item.produtos;
            const custoMedio = produto?.custo_medio || 0;
            const custoCalculado = (item.quantidade || 1) * custoMedio;

            vendas.push({
              transacao_id: t.id,
              item_id: item.id,
              empresa_id: t.empresa_id,
              canal: t.canal,
              canal_venda: t.canal_venda,
              conta_nome: t.conta_nome,
              pedido_id: t.pedido_id,
              data_venda: t.data_transacao,
              data_repasse: t.data_repasse,
              tipo_transacao: t.tipo_transacao,
              descricao: t.descricao,
              status: t.status,
              referencia_externa: t.referencia_externa,
              valor_bruto: item.preco_total || t.valor_bruto || 0,
              valor_liquido: t.valor_liquido || 0,
              tarifas: t.tarifas || 0,
              taxas: t.taxas || 0,
              outros_descontos: t.outros_descontos || 0,
              tipo_lancamento: t.tipo_lancamento,
              sku_marketplace: item.sku_marketplace,
              anuncio_id: item.anuncio_id,
              descricao_item: item.descricao_item,
              quantidade: item.quantidade || 1,
              preco_unitario: item.preco_unitario || 0,
              preco_total: item.preco_total || 0,
              produto_id: item.produto_id,
              sku_interno: produto?.sku || null,
              produto_nome: produto?.nome || null,
              custo_medio: custoMedio,
              cmv_total: null,
              cmv_margem_bruta: null,
              cmv_margem_percentual: null,
              custo_calculado: custoCalculado,
              sem_produto_vinculado: !item.produto_id,
              sem_custo: custoMedio === 0,
              sem_categoria: !t.categoria_id,
              nao_conciliado: naoConciliado,
              categoria_id: t.categoria_id,
              centro_custo_id: t.centro_custo_id,
              frete_comprador: t.frete_comprador || 0,
              frete_vendedor: t.frete_vendedor || 0,
              custo_ads: t.custo_ads || 0,
              tipo_envio: t.tipo_envio,
            } as VendaDetalhada);
          });
        }
      });

      return vendas;
    },
    enabled: !!empresaAtiva?.id,
    refetchInterval: 60 * 1000, // Auto-refresh a cada 1 minuto
    refetchIntervalInBackground: false, // Só atualiza quando a aba está ativa
  });

  const vendasFiltradas = useMemo(
    () => aplicarFiltrosLocais(data || [], filtros),
    [data, filtros]
  );

  const resumo = useMemo(
    () => calcularResumo(vendasFiltradas, aliquotaImposto),
    [vendasFiltradas, aliquotaImposto]
  );

  const consistencia = useMemo(
    () => calcularConsistencia(vendasFiltradas),
    [vendasFiltradas]
  );

  // Canais e contas únicos para filtros
  const canaisDisponiveis = useMemo(() => {
    const canais = new Set<string>();
    (data || []).forEach((v) => {
      if (v.canal) canais.add(v.canal);
    });
    return Array.from(canais).sort();
  }, [data]);

  const contasDisponiveis = useMemo(() => {
    const contas = new Set<string>();
    (data || []).forEach((v) => {
      if (v.conta_nome) contas.add(v.conta_nome);
    });
    return Array.from(contas).sort();
  }, [data]);

  // NOVO: Conciliar transação rapidamente
  const conciliarTransacao = async (transacaoId: string) => {
    const { error } = await supabase
      .from("marketplace_transactions")
      .update({ status: "conciliado" })
      .eq("id", transacaoId);

    if (error) {
      console.error("Erro ao conciliar:", error);
      throw error;
    }

    await refetch();
    return true;
  };

  return {
    vendas: vendasFiltradas,
    resumo,
    consistencia,
    canaisDisponiveis,
    contasDisponiveis,
    aliquotaImposto,
    isLoading,
    error,
    refetch,
    conciliarTransacao,
    dataUpdatedAt, // Timestamp da última atualização
  };
}
