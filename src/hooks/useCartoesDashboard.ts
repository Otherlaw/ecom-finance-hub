import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";

interface UseCartoesDashboardParams {
  cartaoId?: string; // undefined = todos os cartões
  periodo?: string;  // formato "YYYY-MM", undefined = mês atual
}

export const useCartoesDashboard = (params?: UseCartoesDashboardParams) => {
  const { cartaoId, periodo } = params || {};

  // Calcular intervalo de datas baseado no período
  const periodoDate = periodo ? new Date(`${periodo}-01`) : new Date();
  const dataInicio = format(startOfMonth(periodoDate), "yyyy-MM-dd");
  const dataFim = format(endOfMonth(periodoDate), "yyyy-MM-dd");

  // Query para transações filtradas
  const { data: transacoes, isLoading: isLoadingTransacoes } = useQuery({
    queryKey: ["dashboard-cartoes-transacoes", cartaoId, periodo],
    queryFn: async () => {
      let query = supabase
        .from("credit_card_transactions")
        .select(`
          *,
          fatura:credit_card_invoices(id, mes_referencia, credit_card_id),
          categoria:categorias_financeiras(id, nome),
          centro_custo:centros_de_custo(id, nome),
          responsavel:responsaveis(id, nome)
        `)
        .gte("data_transacao", dataInicio)
        .lte("data_transacao", dataFim)
        .order("data_transacao", { ascending: false });

      // Filtrar por cartão via invoice
      if (cartaoId) {
        // Primeiro buscar as faturas do cartão
        const { data: faturas } = await supabase
          .from("credit_card_invoices")
          .select("id")
          .eq("credit_card_id", cartaoId);

        if (faturas && faturas.length > 0) {
          const faturaIds = faturas.map((f) => f.id);
          query = query.in("invoice_id", faturaIds);
        } else {
          // Se não há faturas para esse cartão, retorna array vazio
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Query para faturas filtradas
  const { data: faturas, isLoading: isLoadingFaturas } = useQuery({
    queryKey: ["dashboard-cartoes-faturas", cartaoId, periodo],
    queryFn: async () => {
      let query = supabase
        .from("credit_card_invoices")
        .select(`
          *,
          cartao:credit_cards(id, nome, instituicao_financeira, limite_credito)
        `)
        .gte("data_vencimento", dataInicio)
        .lte("data_vencimento", dataFim)
        .order("data_vencimento", { ascending: true });

      if (cartaoId) {
        query = query.eq("credit_card_id", cartaoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Query para cartões (para calcular limite disponível)
  const { data: cartoes, isLoading: isLoadingCartoes } = useQuery({
    queryKey: ["dashboard-cartoes-cards", cartaoId],
    queryFn: async () => {
      let query = supabase
        .from("credit_cards")
        .select("*")
        .eq("ativo", true);

      if (cartaoId) {
        query = query.eq("id", cartaoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Calcular KPIs
  const kpis = {
    totalFaturasAbertas: 0,
    qtdFaturasPendentes: 0,
    vencendo7Dias: 0,
    qtdVencendo7Dias: 0,
    limiteTotal: 0,
    limiteUsado: 0,
    limiteDisponivel: 0,
    gastosMesAtual: 0,
    qtdTransacoes: 0,
  };

  if (faturas) {
    const hoje = new Date();
    const em7Dias = new Date();
    em7Dias.setDate(hoje.getDate() + 7);

    faturas.forEach((f: any) => {
      if (!f.pago) {
        kpis.totalFaturasAbertas += Number(f.valor_total) || 0;
        kpis.qtdFaturasPendentes += 1;

        const vencimento = new Date(f.data_vencimento);
        if (vencimento >= hoje && vencimento <= em7Dias) {
          kpis.vencendo7Dias += Number(f.valor_total) || 0;
          kpis.qtdVencendo7Dias += 1;
        }
      }
    });
  }

  if (cartoes) {
    cartoes.forEach((c: any) => {
      kpis.limiteTotal += Number(c.limite_credito) || 0;
    });
  }

  if (transacoes) {
    transacoes.forEach((t: any) => {
      kpis.gastosMesAtual += Number(t.valor) || 0;
    });
    kpis.qtdTransacoes = transacoes.length;
  }

  kpis.limiteUsado = kpis.gastosMesAtual;
  kpis.limiteDisponivel = kpis.limiteTotal - kpis.limiteUsado;

  return {
    transacoes: transacoes || [],
    faturas: faturas || [],
    cartoes: cartoes || [],
    kpis,
    isLoading: isLoadingTransacoes || isLoadingFaturas || isLoadingCartoes,
    dataInicio,
    dataFim,
  };
};

// Helper para gerar opções de períodos (últimos 12 meses)
export const gerarOpcoesPeriodo = () => {
  const opcoes: { value: string; label: string }[] = [];
  const hoje = new Date();

  for (let i = 0; i < 12; i++) {
    const data = subMonths(hoje, i);
    const value = format(data, "yyyy-MM");
    const label = format(data, "MMMM yyyy", { locale: require("date-fns/locale/pt-BR").ptBR });
    // Capitalizar primeira letra
    const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1);
    opcoes.push({ value, label: labelCapitalized });
  }

  return opcoes;
};
