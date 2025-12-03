import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface LancamentoDRE {
  id: string;
  data: string;
  valor: number;
  origem: "cartao" | "contas_pagar" | "contas_receber";
  categoria_id: string | null;
  categoria_tipo: string | null;
  categoria_nome: string | null;
}

interface DRELinha {
  nome: string;
  valor: number;
  tipo: string;
  categorias: Array<{ nome: string; valor: number }>;
}

interface DREData {
  periodo: string;
  receitaBruta: number;
  custos: DRELinha;
  lucroBruto: number;
  despesasOperacionais: DRELinha;
  despesasComercialMarketing: DRELinha;
  despesasAdministrativas: DRELinha;
  despesasPessoal: DRELinha;
  despesasFinanceiras: DRELinha;
  impostos: DRELinha;
  outrasReceitasDespesas: DRELinha;
  totalDespesas: number;
  ebitda: number;
  lucroAntesIR: number;
  lucroLiquido: number;
  linhasPorTipo: Record<string, DRELinha>;
}

export function useDREData(mes?: string, ano?: number) {
  const currentDate = new Date();
  const selectedMonth = mes || String(currentDate.getMonth() + 1).padStart(2, "0");
  const selectedYear = ano || currentDate.getFullYear();

  // Busca transações de cartão categorizadas do período
  const { data: transacoesCartao, isLoading: isLoadingCartao } = useQuery({
    queryKey: ["dre-transacoes-cartao", selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-${selectedMonth}-01`;
      const endDate = new Date(selectedYear, parseInt(selectedMonth), 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("credit_card_transactions")
        .select(`
          id,
          valor,
          data_transacao,
          tipo_movimento,
          categoria_id,
          categoria:categorias_financeiras(id, nome, tipo)
        `)
        .gte("data_transacao", startDate)
        .lte("data_transacao", endDate)
        .eq("status", "conciliado");

      if (error) throw error;
      
      // Normaliza para LancamentoDRE
      return (data || []).map((t): LancamentoDRE => ({
        id: t.id,
        data: t.data_transacao,
        valor: Math.abs(t.valor),
        origem: "cartao",
        categoria_id: t.categoria_id,
        categoria_tipo: (t.categoria as any)?.tipo || null,
        categoria_nome: (t.categoria as any)?.nome || null,
      }));
    },
  });

  // Busca contas a pagar pagas no período
  const { data: contasPagas, isLoading: isLoadingContas } = useQuery({
    queryKey: ["dre-contas-pagar", selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-${selectedMonth}-01`;
      const endDate = new Date(selectedYear, parseInt(selectedMonth), 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("contas_a_pagar")
        .select(`
          id,
          valor_pago,
          data_pagamento,
          categoria_id,
          categoria:categorias_financeiras(id, nome, tipo)
        `)
        .in("status", ["pago", "parcialmente_pago"])
        .gte("data_pagamento", startDate)
        .lte("data_pagamento", endDate);

      if (error) throw error;
      
      // Normaliza para LancamentoDRE
      return (data || []).map((c): LancamentoDRE => ({
        id: c.id,
        data: c.data_pagamento || "",
        valor: c.valor_pago,
        origem: "contas_pagar",
        categoria_id: c.categoria_id,
        categoria_tipo: (c.categoria as any)?.tipo || null,
        categoria_nome: (c.categoria as any)?.nome || null,
      }));
    },
  });

  // Busca contas a receber recebidas no período (RECEITAS)
  const { data: contasRecebidas, isLoading: isLoadingReceber } = useQuery({
    queryKey: ["dre-contas-receber", selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-${selectedMonth}-01`;
      const endDate = new Date(selectedYear, parseInt(selectedMonth), 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("contas_a_receber")
        .select(`
          id,
          valor_recebido,
          data_recebimento,
          categoria_id,
          categoria:categorias_financeiras(id, nome, tipo)
        `)
        .in("status", ["recebido", "parcialmente_recebido"])
        .gte("data_recebimento", startDate)
        .lte("data_recebimento", endDate);

      if (error) throw error;
      
      // Normaliza para LancamentoDRE
      return (data || []).map((c): LancamentoDRE => ({
        id: c.id,
        data: c.data_recebimento || "",
        valor: c.valor_recebido,
        origem: "contas_receber",
        categoria_id: c.categoria_id,
        categoria_tipo: (c.categoria as any)?.tipo || null,
        categoria_nome: (c.categoria as any)?.nome || null,
      }));
    },
  });

  // Busca todas as categorias para estrutura
  const { data: categorias, isLoading: isLoadingCategorias } = useQuery({
    queryKey: ["categorias-dre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .eq("ativo", true)
        .order("tipo")
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  // Combina todas as transações
  const lancamentos = useMemo(() => {
    return [...(transacoesCartao || []), ...(contasPagas || []), ...(contasRecebidas || [])];
  }, [transacoesCartao, contasPagas, contasRecebidas]);

  // Processa dados do DRE
  const dreData = useMemo<DREData | null>(() => {
    if (!categorias) return null;

    // Agrupa lançamentos por tipo de categoria
    const porTipo: Record<string, { total: number; categorias: Record<string, number> }> = {};

    lancamentos.forEach((l) => {
      if (!l.categoria_tipo) return;

      const tipo = l.categoria_tipo;
      const categoriaNome = l.categoria_nome || "Sem nome";
      const valor = l.valor;

      if (!porTipo[tipo]) {
        porTipo[tipo] = { total: 0, categorias: {} };
      }

      porTipo[tipo].total += valor;
      porTipo[tipo].categorias[categoriaNome] = (porTipo[tipo].categorias[categoriaNome] || 0) + valor;
    });

    // Converte para formato DRELinha
    const criarLinha = (tipo: string): DRELinha => {
      const dados = porTipo[tipo] || { total: 0, categorias: {} };
      return {
        nome: tipo,
        valor: dados.total,
        tipo,
        categorias: Object.entries(dados.categorias).map(([nome, valor]) => ({ nome, valor })),
      };
    };

    // Extrai valores por tipo (usando novos nomes padronizados)
    const receitas = criarLinha("Receitas");
    const custos = criarLinha("Custos");
    const despesasOperacionais = criarLinha("Despesas Operacionais");
    const despesasComercialMarketing = criarLinha("Despesas Comercial / Marketing");
    const despesasAdministrativas = criarLinha("Despesas Administrativas / Gerais");
    const despesasPessoal = criarLinha("Despesas com Pessoal");
    const despesasFinanceiras = criarLinha("Despesas Financeiras");
    const impostos = criarLinha("Impostos Sobre o Resultado");
    const outrasReceitasDespesas = criarLinha("Outras Receitas / Despesas");

    // Cálculos do DRE
    const receitaBruta = receitas.valor;
    const totalCustos = custos.valor;
    const lucroBruto = receitaBruta - totalCustos;
    
    const totalDespesas =
      despesasOperacionais.valor +
      despesasComercialMarketing.valor +
      despesasAdministrativas.valor +
      despesasPessoal.valor +
      despesasFinanceiras.valor;

    const ebitda = lucroBruto - totalDespesas;
    const lucroAntesIR = ebitda + outrasReceitasDespesas.valor;
    const lucroLiquido = lucroAntesIR - impostos.valor;

    // Mapa de todas as linhas por tipo
    const linhasPorTipo: Record<string, DRELinha> = {};
    categorias.forEach((cat) => {
      if (!linhasPorTipo[cat.tipo]) {
        linhasPorTipo[cat.tipo] = criarLinha(cat.tipo);
      }
    });

    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const periodo = `${meses[parseInt(selectedMonth) - 1]} ${selectedYear}`;

    return {
      periodo,
      receitaBruta,
      custos,
      lucroBruto,
      despesasOperacionais,
      despesasComercialMarketing,
      despesasAdministrativas,
      despesasPessoal,
      despesasFinanceiras,
      impostos,
      outrasReceitasDespesas,
      totalDespesas,
      ebitda,
      lucroAntesIR,
      lucroLiquido,
      linhasPorTipo,
    };
  }, [lancamentos, categorias, selectedMonth, selectedYear]);

  // Estatísticas adicionais
  const stats = useMemo(() => {
    if (!dreData) return null;

    const margemBruta = dreData.receitaBruta > 0 
      ? (dreData.lucroBruto / dreData.receitaBruta) * 100 
      : 0;
    
    const margemOperacional = dreData.receitaBruta > 0 
      ? (dreData.ebitda / dreData.receitaBruta) * 100 
      : 0;
    
    const margemLiquida = dreData.receitaBruta > 0 
      ? (dreData.lucroLiquido / dreData.receitaBruta) * 100 
      : 0;

    const custosPercentual = dreData.receitaBruta > 0 
      ? (dreData.custos.valor / dreData.receitaBruta) * 100 
      : 0;

    const despesasPercentual = dreData.receitaBruta > 0 
      ? (dreData.totalDespesas / dreData.receitaBruta) * 100 
      : 0;

    return {
      margemBruta,
      margemOperacional,
      margemLiquida,
      custosPercentual,
      despesasPercentual,
    };
  }, [dreData]);

  // Contagem por origem
  const transacoesCartaoCount = transacoesCartao?.length || 0;
  const contasPagasCount = contasPagas?.length || 0;
  const contasRecebidasCount = contasRecebidas?.length || 0;
  const totalLancamentos = lancamentos.length;

  return {
    dreData,
    stats,
    transacoesCount: totalLancamentos,
    transacoesCartaoCount,
    contasPagasCount,
    contasRecebidasCount,
    isLoading: isLoadingCartao || isLoadingContas || isLoadingReceber || isLoadingCategorias,
    hasData: totalLancamentos > 0,
  };
}

// Períodos disponíveis (últimos 12 meses com dados)
export function usePeridosDisponiveis() {
  return useQuery({
    queryKey: ["periodos-dre"],
    queryFn: async () => {
      // Busca períodos de transações de cartão
      const { data: cartaoData, error: cartaoError } = await supabase
        .from("credit_card_transactions")
        .select("data_transacao")
        .eq("status", "conciliado")
        .order("data_transacao", { ascending: false });

      if (cartaoError) throw cartaoError;

      // Busca períodos de contas pagas
      const { data: contasData, error: contasError } = await supabase
        .from("contas_a_pagar")
        .select("data_pagamento")
        .in("status", ["pago", "parcialmente_pago"])
        .not("data_pagamento", "is", null)
        .order("data_pagamento", { ascending: false });

      if (contasError) throw contasError;

      // Combina e extrai meses únicos
      const periodos = new Set<string>();
      
      cartaoData?.forEach((t) => {
        const date = new Date(t.data_transacao);
        periodos.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      });

      contasData?.forEach((c) => {
        if (c.data_pagamento) {
          const date = new Date(c.data_pagamento);
          periodos.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
        }
      });

      // Ordena decrescente e limita a 12 meses
      const sortedPeriodos = Array.from(periodos).sort().reverse().slice(0, 12);

      return sortedPeriodos.map((p) => {
        const [ano, mes] = p.split("-");
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                       "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return {
          value: p,
          label: `${meses[parseInt(mes) - 1]} ${ano}`,
          mes,
          ano: parseInt(ano),
        };
      });
    },
  });
}
