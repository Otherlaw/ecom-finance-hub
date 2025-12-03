import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface TransacaoComCategoria {
  id: string;
  valor: number;
  data_transacao: string;
  tipo_movimento: string | null;
  categoria: {
    id: string;
    nome: string;
    tipo: string;
  } | null;
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
  deducoes: DRELinha;
  cmv: DRELinha;
  receitaLiquida: number;
  lucroBruto: number;
  despesasOperacionais: DRELinha;
  despesasPessoal: DRELinha;
  despesasAdministrativas: DRELinha;
  marketing: DRELinha;
  despesasFinanceiras: DRELinha;
  impostos: DRELinha;
  totalDespesas: number;
  ebitda: number;
  lucroLiquido: number;
  linhasPorTipo: Record<string, DRELinha>;
}

export function useDREData(mes?: string, ano?: number) {
  const currentDate = new Date();
  const selectedMonth = mes || String(currentDate.getMonth() + 1).padStart(2, "0");
  const selectedYear = ano || currentDate.getFullYear();

  // Busca transações categorizadas do período
  const { data: transacoes, isLoading: isLoadingTransacoes } = useQuery({
    queryKey: ["dre-transacoes", selectedMonth, selectedYear],
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
          categoria:categorias_financeiras(id, nome, tipo)
        `)
        .gte("data_transacao", startDate)
        .lte("data_transacao", endDate)
        .eq("status", "conciliado");

      if (error) throw error;
      return data as TransacaoComCategoria[];
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

  // Processa dados do DRE
  const dreData = useMemo<DREData | null>(() => {
    if (!transacoes || !categorias) return null;

    // Agrupa transações por tipo de categoria
    const porTipo: Record<string, { total: number; categorias: Record<string, number> }> = {};

    transacoes.forEach((t) => {
      if (!t.categoria) return;

      const tipo = t.categoria.tipo;
      const categoriaNome = t.categoria.nome;
      // Valor positivo = despesa/saída, negativo = receita/entrada (crédito no cartão)
      const valor = Math.abs(t.valor);

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

    // Extrai valores por tipo
    const receitas = criarLinha("Receitas");
    const deducoes = criarLinha("Deduções");
    const cmv = criarLinha("CMV");
    const despesasOperacionais = criarLinha("Despesas Operacionais");
    const despesasPessoal = criarLinha("Despesas Pessoal");
    const despesasAdministrativas = criarLinha("Despesas Administrativas");
    const marketing = criarLinha("Marketing");
    const despesasFinanceiras = criarLinha("Despesas Financeiras");
    const impostos = criarLinha("Impostos");

    // Cálculos do DRE
    const receitaBruta = receitas.valor;
    const totalDeducoes = deducoes.valor;
    const receitaLiquida = receitaBruta - totalDeducoes;
    const lucroBruto = receitaLiquida - cmv.valor;
    
    const totalDespesas =
      despesasOperacionais.valor +
      despesasPessoal.valor +
      despesasAdministrativas.valor +
      marketing.valor +
      despesasFinanceiras.valor +
      impostos.valor;

    const ebitda = lucroBruto - totalDespesas;
    const lucroLiquido = ebitda;

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
      deducoes,
      cmv,
      receitaLiquida,
      lucroBruto,
      despesasOperacionais,
      despesasPessoal,
      despesasAdministrativas,
      marketing,
      despesasFinanceiras,
      impostos,
      totalDespesas,
      ebitda,
      lucroLiquido,
      linhasPorTipo,
    };
  }, [transacoes, categorias, selectedMonth, selectedYear]);

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

    const cmvPercentual = dreData.receitaBruta > 0 
      ? (dreData.cmv.valor / dreData.receitaBruta) * 100 
      : 0;

    const despesasPercentual = dreData.receitaBruta > 0 
      ? (dreData.totalDespesas / dreData.receitaBruta) * 100 
      : 0;

    return {
      margemBruta,
      margemOperacional,
      margemLiquida,
      cmvPercentual,
      despesasPercentual,
    };
  }, [dreData]);

  return {
    dreData,
    stats,
    transacoesCount: transacoes?.length || 0,
    isLoading: isLoadingTransacoes || isLoadingCategorias,
    hasData: (transacoes?.length || 0) > 0,
  };
}

// Períodos disponíveis (últimos 12 meses)
export function usePeridosDisponiveis() {
  return useQuery({
    queryKey: ["periodos-dre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_card_transactions")
        .select("data_transacao")
        .eq("status", "conciliado")
        .order("data_transacao", { ascending: false });

      if (error) throw error;

      // Extrai meses únicos
      const periodos = new Set<string>();
      data?.forEach((t) => {
        const date = new Date(t.data_transacao);
        periodos.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      });

      return Array.from(periodos).slice(0, 12).map((p) => {
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
