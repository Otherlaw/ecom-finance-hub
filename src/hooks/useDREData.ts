import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface LancamentoDRE {
  id: string;
  data: string;
  valor: number;
  origem: "cartao" | "banco" | "contas_pagar" | "contas_receber" | "marketplace" | "manual";
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

  // Busca movimentos financeiros da tabela unificada (MEU)
  const { data: movimentosMEU, isLoading: isLoadingMEU } = useQuery({
    queryKey: ["dre-movimentos-meu", selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-${selectedMonth}-01`;
      const endDate = new Date(selectedYear, parseInt(selectedMonth), 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("movimentos_financeiros")
        .select(`
          id,
          data,
          valor,
          tipo,
          origem,
          categoria_id,
          categoria_nome,
          categoria:categorias_financeiras(id, nome, tipo)
        `)
        .gte("data", startDate)
        .lte("data", endDate);

      if (error) throw error;
      
      // Normaliza para LancamentoDRE
      return (data || []).map((m: any): LancamentoDRE => ({
        id: m.id,
        data: m.data,
        valor: Math.abs(m.valor),
        origem: m.origem,
        categoria_id: m.categoria_id,
        categoria_tipo: (m.categoria as any)?.tipo || null,
        categoria_nome: m.categoria_nome || (m.categoria as any)?.nome || null,
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

  // Usa os movimentos da tabela unificada
  const lancamentos = useMemo(() => {
    return movimentosMEU || [];
  }, [movimentosMEU]);

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
  const totalLancamentos = lancamentos.length;
  const transacoesCartaoCount = lancamentos.filter((l) => l.origem === "cartao").length;
  const contasPagasCount = lancamentos.filter((l) => l.origem === "contas_pagar").length;
  const contasRecebidasCount = lancamentos.filter((l) => l.origem === "contas_receber").length;

  return {
    dreData,
    stats,
    transacoesCount: totalLancamentos,
    transacoesCartaoCount,
    contasPagasCount,
    contasRecebidasCount,
    isLoading: isLoadingMEU || isLoadingCategorias,
    hasData: totalLancamentos > 0,
  };
}

// Períodos disponíveis (últimos 12 meses com dados)
export function usePeridosDisponiveis() {
  return useQuery({
    queryKey: ["periodos-dre"],
    queryFn: async () => {
      // Busca períodos da tabela unificada (MEU)
      const { data: movimentosData, error } = await supabase
        .from("movimentos_financeiros")
        .select("data")
        .order("data", { ascending: false });

      if (error) throw error;

      // Extrai meses únicos
      const periodos = new Set<string>();
      
      movimentosData?.forEach((m) => {
        const date = new Date(m.data);
        periodos.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
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
