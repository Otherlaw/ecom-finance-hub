import { useState, useCallback, useMemo } from "react";
import { PeriodOption, DateRange, getDateRangeForPeriod } from "@/components/PeriodFilter";
import { differenceInDays, format } from "date-fns";
import { 
  kpis as baseKpis, 
  channelData as baseChannelData,
  formatCurrency,
  formatNumber,
  formatPercentage,
} from "@/lib/mock-data";

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

// Simulates different data for different periods
// In a real app, this would fetch from the database
function calculateKPIsForPeriod(dateRange: DateRange): KPIDataState {
  const days = differenceInDays(dateRange.to, dateRange.from) + 1;
  
  // Apply a multiplier based on the period length
  // This simulates having less data for shorter periods
  const periodMultiplier = Math.min(days / 30, 1);
  
  // Add some variance based on the date range to simulate real data
  const variance = (dateRange.from.getDate() % 10) / 100;
  
  const faturamento = Math.round(baseKpis.faturamentoMensal * periodMultiplier * (1 + variance));
  const cmv = Math.round(baseKpis.cmv * periodMultiplier * (1 + variance * 0.5));
  const custoOp = Math.round(baseKpis.custoOperacional * periodMultiplier * (1 - variance * 0.3));
  const lucro = faturamento - cmv - custoOp;
  const pedidos = Math.round(baseKpis.pedidos * periodMultiplier * (1 + variance * 0.8));
  
  return {
    faturamentoMensal: faturamento,
    faturamentoVariacao: baseKpis.faturamentoVariacao * (1 + variance),
    lucroLiquido: lucro,
    lucroVariacao: lucro >= 0 ? 5.2 : -165.2,
    margemBruta: Number(((faturamento - cmv) / faturamento * 100).toFixed(1)),
    margemBrutaVariacao: baseKpis.margemBrutaVariacao,
    margemLiquida: Number((lucro / faturamento * 100).toFixed(1)),
    margemLiquidaVariacao: lucro >= 0 ? 2.1 : -15.8,
    ticketMedio: pedidos > 0 ? Math.round(faturamento / pedidos * 100) / 100 : 0,
    ticketMedioVariacao: baseKpis.ticketMedioVariacao,
    pedidos: pedidos,
    pedidosVariacao: baseKpis.pedidosVariacao * (1 - variance * 0.5),
    cmv: cmv,
    cmvPercentual: Number((cmv / faturamento * 100).toFixed(1)),
    custoOperacional: custoOp,
    custoOperacionalPercentual: Number((custoOp / faturamento * 100).toFixed(1)),
  };
}

function calculateChannelDataForPeriod(dateRange: DateRange): ChannelKPIData[] {
  const days = differenceInDays(dateRange.to, dateRange.from) + 1;
  const periodMultiplier = Math.min(days / 30, 1);
  const variance = (dateRange.from.getDate() % 10) / 100;
  
  return baseChannelData
    .map((channel, index) => {
      const adjustedReceita = Math.round(channel.receitaBruta * periodMultiplier * (1 + variance * (index + 1) * 0.1));
      return {
        channel: channel.channel,
        color: channel.color,
        receitaBruta: adjustedReceita,
        percentual: channel.percentual,
        crescimento: Number((Math.random() * 20 - 5).toFixed(1)),
      };
    });
}

export function useKPIData() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("30days");
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeForPeriod("30days"));
  const [isLoading, setIsLoading] = useState(false);

  const handlePeriodChange = useCallback((period: PeriodOption, newDateRange: DateRange) => {
    setIsLoading(true);
    setSelectedPeriod(period);
    setDateRange(newDateRange);
    
    // Simulate API call delay
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  const kpiData = useMemo(() => {
    return calculateKPIsForPeriod(dateRange);
  }, [dateRange]);

  const channelData = useMemo(() => {
    return calculateChannelDataForPeriod(dateRange);
  }, [dateRange]);

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
            value: formatCurrency(12.5 * (1 + (kpiData.pedidosVariacao / 100))), 
            change: -5.2, 
            target: 10, 
            current: 12.5 * (1 + (kpiData.pedidosVariacao / 100))
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
  };
}
