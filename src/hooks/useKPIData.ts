import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PeriodOption, DateRange, getDateRangeForPeriod } from "@/components/PeriodFilter";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

// Helpers de formatação
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

export const formatPercentage = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export interface KPIDataState {
  faturamentoMensal: number;
  faturamentoVariacao: number;
  lucroLiquido: number;
  lucroVariacao: number;
  margemBruta: number;
  margemBrutaVariacao: number;
  margemLiquida: number;
  margemLiquidaVariacao: number;
  ticketMedio: number;
  ticketMedioVariacao: number;
  pedidos: number;
  pedidosVariacao: number;
  cmv: number;
  cmvPercentual: number;
  custoOperacional: number;
  custoOperacionalPercentual: number;
}

export interface ChannelKPIData {
  channel: string;
  color: string;
  receitaBruta: number;
  percentual: number;
  crescimento: number;
}

export interface KPICategoryItem {
  label: string;
  value: string;
  change?: number;
  sublabel?: string;
  target: number;
  current: number;
}

export interface KPICategory {
  title: string;
  icon: any;
  kpis: KPICategoryItem[];
}

const CHANNEL_COLORS: Record<string, string> = {
  "mercado_livre": "#FFE600",
  "mercado livre": "#FFE600",
  "shopee": "#EE4D2D",
  "shein": "#000000",
  "tiktok": "#00F2EA",
  "tiktok shop": "#00F2EA",
  "amazon": "#FF9900",
  "magalu": "#0086FF",
  "outros": "#9CA3AF",
};

export function useKPIData() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("30days");
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeForPeriod("30days"));

  const periodoInicio = format(dateRange.from, "yyyy-MM-dd");
  const periodoFim = format(dateRange.to, "yyyy-MM-dd");

  // Período anterior para cálculo de variação
  const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const periodoAnteriorFim = format(subMonths(dateRange.from, 0), "yyyy-MM-dd");
  const periodoAnteriorInicio = format(new Date(dateRange.from.getTime() - daysDiff * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

  // Query para movimentos financeiros do período atual
  const { data: movimentosAtuais, isLoading: loadingAtuais } = useQuery({
    queryKey: ["kpi-movimentos", periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentos_financeiros")
        .select("id, data, tipo, valor, origem, categoria_id")
        .gte("data", periodoInicio)
        .lte("data", periodoFim);
      if (error) throw error;
      return data || [];
    },
  });

  // Query para movimentos do período anterior (comparação)
  const { data: movimentosAnteriores, isLoading: loadingAnteriores } = useQuery({
    queryKey: ["kpi-movimentos-anterior", periodoAnteriorInicio, periodoAnteriorFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentos_financeiros")
        .select("id, data, tipo, valor, origem")
        .gte("data", periodoAnteriorInicio)
        .lt("data", periodoInicio);
      if (error) throw error;
      return data || [];
    },
  });

  // Query para marketplace transactions por canal
  const { data: marketplaceData, isLoading: loadingMarketplace } = useQuery({
    queryKey: ["kpi-marketplace", periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_transactions")
        .select("id, canal, valor_liquido, valor_bruto, data_transacao, status")
        .gte("data_transacao", periodoInicio)
        .lte("data_transacao", periodoFim);
      if (error) throw error;
      return data || [];
    },
  });

  // Query para pedidos (contas a receber)
  const { data: pedidosData, isLoading: loadingPedidos } = useQuery({
    queryKey: ["kpi-pedidos", periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_a_receber")
        .select("id, valor_total, data_emissao")
        .gte("data_emissao", periodoInicio)
        .lte("data_emissao", periodoFim);
      if (error) throw error;
      return data || [];
    },
  });

  // Query para CMV
  const { data: cmvData, isLoading: loadingCmv } = useQuery({
    queryKey: ["kpi-cmv", periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_registros")
        .select("id, custo_total, data")
        .gte("data", periodoInicio)
        .lte("data", periodoFim);
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingAtuais || loadingAnteriores || loadingMarketplace || loadingPedidos || loadingCmv;

  // Cálculos dos KPIs
  const kpiData = useMemo((): KPIDataState => {
    const entradas = movimentosAtuais?.filter((m) => m.tipo === "entrada") || [];
    const saidas = movimentosAtuais?.filter((m) => m.tipo === "saida") || [];
    
    const faturamento = entradas.reduce((acc, m) => acc + Number(m.valor), 0);
    const despesas = saidas.reduce((acc, m) => acc + Number(m.valor), 0);
    const lucro = faturamento - despesas;

    // Período anterior
    const entradasAnt = movimentosAnteriores?.filter((m) => m.tipo === "entrada") || [];
    const saidasAnt = movimentosAnteriores?.filter((m) => m.tipo === "saida") || [];
    const faturamentoAnt = entradasAnt.reduce((acc, m) => acc + Number(m.valor), 0);
    const despesasAnt = saidasAnt.reduce((acc, m) => acc + Number(m.valor), 0);
    const lucroAnt = faturamentoAnt - despesasAnt;

    // Variações
    const faturamentoVariacao = faturamentoAnt > 0 ? ((faturamento - faturamentoAnt) / faturamentoAnt) * 100 : 0;
    const lucroVariacao = lucroAnt !== 0 ? ((lucro - lucroAnt) / Math.abs(lucroAnt)) * 100 : 0;

    // CMV
    const cmvTotal = cmvData?.reduce((acc, c) => acc + Number(c.custo_total), 0) || 0;
    const cmvPercentual = faturamento > 0 ? (cmvTotal / faturamento) * 100 : 0;

    // Pedidos
    const pedidos = pedidosData?.length || marketplaceData?.length || 0;
    const ticketMedio = pedidos > 0 ? faturamento / pedidos : 0;

    // Margens
    const margemBruta = faturamento > 0 ? ((faturamento - cmvTotal) / faturamento) * 100 : 0;
    const margemLiquida = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

    // Custo operacional (despesas exceto CMV)
    const custoOperacional = despesas;
    const custoOperacionalPercentual = faturamento > 0 ? (custoOperacional / faturamento) * 100 : 0;

    return {
      faturamentoMensal: faturamento,
      faturamentoVariacao,
      lucroLiquido: lucro,
      lucroVariacao,
      margemBruta: Number(margemBruta.toFixed(1)),
      margemBrutaVariacao: 0, // Simplificado
      margemLiquida: Number(margemLiquida.toFixed(1)),
      margemLiquidaVariacao: 0,
      ticketMedio,
      ticketMedioVariacao: 0,
      pedidos,
      pedidosVariacao: 0,
      cmv: cmvTotal,
      cmvPercentual: Number(cmvPercentual.toFixed(1)),
      custoOperacional,
      custoOperacionalPercentual: Number(custoOperacionalPercentual.toFixed(1)),
    };
  }, [movimentosAtuais, movimentosAnteriores, cmvData, pedidosData, marketplaceData]);

  // Performance por canal
  const channelData = useMemo((): ChannelKPIData[] => {
    if (!marketplaceData || marketplaceData.length === 0) return [];

    const channelTotals: Record<string, number> = {};
    
    marketplaceData.forEach((t) => {
      const canal = (t.canal || "outros").toLowerCase();
      if (!channelTotals[canal]) channelTotals[canal] = 0;
      channelTotals[canal] += Number(t.valor_liquido || 0);
    });

    const totalReceita = Object.values(channelTotals).reduce((a, b) => a + b, 0);

    return Object.entries(channelTotals)
      .map(([channel, receita]) => ({
        channel: channel.charAt(0).toUpperCase() + channel.slice(1).replace("_", " "),
        color: CHANNEL_COLORS[channel] || CHANNEL_COLORS["outros"],
        receitaBruta: receita,
        percentual: totalReceita > 0 ? Number(((receita / totalReceita) * 100).toFixed(1)) : 0,
        crescimento: 0, // Simplificado
      }))
      .sort((a, b) => b.receitaBruta - a.receitaBruta);
  }, [marketplaceData]);

  const handlePeriodChange = useCallback((period: PeriodOption, newDateRange: DateRange) => {
    setSelectedPeriod(period);
    setDateRange(newDateRange);
  }, []);

  const kpiCategories = useMemo((): Omit<KPICategory, 'icon'>[] => {
    return [
      {
        title: "Receita",
        kpis: [
          { 
            label: "Faturamento Bruto", 
            value: formatCurrency(kpiData.faturamentoMensal), 
            change: kpiData.faturamentoVariacao, 
            target: 850000, 
            current: kpiData.faturamentoMensal 
          },
          { 
            label: "Ticket Médio", 
            value: formatCurrency(kpiData.ticketMedio), 
            change: kpiData.ticketMedioVariacao, 
            target: 165, 
            current: kpiData.ticketMedio 
          },
          { 
            label: "Pedidos", 
            value: formatNumber(kpiData.pedidos), 
            change: kpiData.pedidosVariacao, 
            target: 5500, 
            current: kpiData.pedidos 
          },
        ],
      },
      {
        title: "Margens",
        kpis: [
          { 
            label: "Margem Bruta", 
            value: `${kpiData.margemBruta}%`, 
            change: kpiData.margemBrutaVariacao, 
            target: 55, 
            current: kpiData.margemBruta 
          },
          { 
            label: "Margem Líquida", 
            value: `${kpiData.margemLiquida}%`, 
            change: kpiData.margemLiquidaVariacao, 
            target: 10, 
            current: kpiData.margemLiquida 
          },
          { 
            label: "EBITDA %", 
            value: `${kpiData.margemLiquida > 0 ? kpiData.margemLiquida : kpiData.margemLiquida - 2}%`, 
            change: kpiData.lucroVariacao, 
            target: 12, 
            current: kpiData.margemLiquida > 0 ? kpiData.margemLiquida : kpiData.margemLiquida - 2 
          },
        ],
      },
      {
        title: "Custos",
        kpis: [
          { 
            label: "CMV", 
            value: formatCurrency(kpiData.cmv), 
            sublabel: `${kpiData.cmvPercentual}% da receita`, 
            target: 30, 
            current: kpiData.cmvPercentual 
          },
          { 
            label: "Custo Operacional", 
            value: formatCurrency(kpiData.custoOperacional), 
            sublabel: `${kpiData.custoOperacionalPercentual}% da receita`, 
            target: 40, 
            current: kpiData.custoOperacionalPercentual 
          },
          { 
            label: "CAC Médio", 
            value: formatCurrency(kpiData.pedidos > 0 ? kpiData.custoOperacional / kpiData.pedidos * 0.1 : 0), 
            change: 0, 
            target: 10, 
            current: kpiData.pedidos > 0 ? kpiData.custoOperacional / kpiData.pedidos * 0.1 : 0
          },
        ],
      },
    ];
  }, [kpiData]);

  const metaFaturamento = useMemo(() => {
    const meta = 850000;
    const percentual = Math.min(Math.round((kpiData.faturamentoMensal / meta) * 100), 100);
    return {
      atual: kpiData.faturamentoMensal,
      meta,
      percentual,
    };
  }, [kpiData.faturamentoMensal]);

  const metaMargemBruta = useMemo(() => {
    const meta = 55;
    const percentual = Math.min(Math.round((kpiData.margemBruta / meta) * 100), 100);
    return {
      atual: kpiData.margemBruta,
      meta,
      percentual,
    };
  }, [kpiData.margemBruta]);

  const metaLucro = useMemo(() => {
    const meta = 50000;
    const percentual = kpiData.lucroLiquido > 0 ? Math.min(Math.round((kpiData.lucroLiquido / meta) * 100), 100) : 0;
    return {
      atual: kpiData.lucroLiquido,
      meta,
      percentual,
    };
  }, [kpiData.lucroLiquido]);

  const periodLabel = useMemo(() => {
    return `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`;
  }, [dateRange]);

  const hasData = (movimentosAtuais?.length || 0) > 0 || (marketplaceData?.length || 0) > 0;

  return {
    selectedPeriod,
    dateRange,
    isLoading,
    handlePeriodChange,
    kpiData,
    channelData,
    kpiCategories,
    metaFaturamento,
    metaMargemBruta,
    metaLucro,
    periodLabel,
    formatCurrency,
    formatNumber,
    formatPercentage,
    hasData,
  };
}
