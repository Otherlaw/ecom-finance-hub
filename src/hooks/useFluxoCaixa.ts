import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

// Tipos para o Fluxo de Caixa
export interface MovimentoCaixa {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  origem: "cartao" | "banco" | "contas_pagar" | "contas_receber" | "manual";
  descricao: string;
  categoriaId: string | null;
  categoriaNome: string | null;
  categoriaTipo: string | null;
  centroCustoId: string | null;
  centroCustoNome: string | null;
  valor: number;
  empresaId: string | null;
  empresaNome: string | null;
  cartaoNome?: string | null;
  fornecedorNome?: string | null;
  status: string;
}

export interface FluxoCaixaResumo {
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  projecao30Dias: number;
}

export interface FluxoCaixaAgregado {
  porDia: { data: string; entradas: number; saidas: number; saldo: number; saldoAcumulado: number }[];
  porCategoria: { categoria: string; tipo: string; valor: number }[];
  porCentroCusto: { centroCusto: string; valor: number }[];
}

interface UseFluxoCaixaParams {
  periodoInicio?: string; // formato YYYY-MM-DD
  periodoFim?: string;
  empresaId?: string;
}

// Tipo auxiliar para contas a receber
interface ContaReceber {
  id: string;
  descricao: string;
  cliente_nome: string;
  data_recebimento: string | null;
  valor_recebido: number;
  status: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  empresa_id: string;
  categoria: { id: string; nome: string; tipo: string } | null;
  centro_custo: { id: string; nome: string } | null;
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
}

/**
 * Hook para buscar e calcular dados do Fluxo de Caixa
 * 
 * Fontes de dados:
 * - credit_card_transactions: transações de cartão categorizadas (SAÍDAS)
 * - contas_a_pagar: títulos pagos (SAÍDAS)
 * 
 * Fontes futuras (preparado para extensão):
 * - contas_a_receber: títulos recebidos (ENTRADAS)
 * - bank_transactions: transações bancárias (ENTRADAS/SAÍDAS)
 */
export const useFluxoCaixa = ({ periodoInicio, periodoFim, empresaId }: UseFluxoCaixaParams = {}) => {
  // Buscar transações de cartão de crédito categorizadas
  const { data: transacoesCartao, isLoading: loadingCartao } = useQuery({
    queryKey: ["fluxo-caixa-cartao", periodoInicio, periodoFim, empresaId],
    queryFn: async () => {
      let query = supabase
        .from("credit_card_transactions")
        .select(`
          id,
          data_transacao,
          descricao,
          valor,
          status,
          categoria_id,
          centro_custo_id,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome),
          fatura:credit_card_invoices(
            id, 
            mes_referencia,
            cartao:credit_cards(
              id, 
              nome,
              empresa:empresas(id, razao_social, nome_fantasia)
            )
          )
        `)
        .eq("status", "conciliado") // Apenas transações categorizadas/conciliadas
        .order("data_transacao", { ascending: true });

      // Filtro por período
      if (periodoInicio) {
        query = query.gte("data_transacao", periodoInicio);
      }
      if (periodoFim) {
        query = query.lte("data_transacao", periodoFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar contas a pagar PAGAS no período
  const { data: contasPagas, isLoading: loadingContas } = useQuery({
    queryKey: ["fluxo-caixa-contas-pagar", periodoInicio, periodoFim, empresaId],
    queryFn: async () => {
      let query = supabase
        .from("contas_a_pagar")
        .select(`
          id,
          descricao,
          fornecedor_nome,
          data_pagamento,
          valor_pago,
          status,
          categoria_id,
          centro_custo_id,
          empresa_id,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome),
          empresa:empresas(id, razao_social, nome_fantasia)
        `)
        .in("status", ["pago", "parcialmente_pago"]) // Apenas títulos com pagamento
        .not("data_pagamento", "is", null) // Deve ter data de pagamento
        .order("data_pagamento", { ascending: true });

      // Filtro por período de pagamento
      if (periodoInicio) {
        query = query.gte("data_pagamento", periodoInicio);
      }
      if (periodoFim) {
        query = query.lte("data_pagamento", periodoFim);
      }

      // Filtro por empresa
      if (empresaId && empresaId !== "todas") {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar contas a receber RECEBIDAS no período (ENTRADAS)
  const { data: contasRecebidas, isLoading: loadingReceber } = useQuery({
    queryKey: ["fluxo-caixa-contas-receber", periodoInicio, periodoFim, empresaId],
    queryFn: async () => {
      let query = supabase
        .from("contas_a_receber")
        .select(`
          id,
          descricao,
          cliente_nome,
          data_recebimento,
          valor_recebido,
          status,
          categoria_id,
          centro_custo_id,
          empresa_id,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome),
          empresa:empresas(id, razao_social, nome_fantasia)
        `)
        .in("status", ["recebido", "parcialmente_recebido"])
        .not("data_recebimento", "is", null)
        .order("data_recebimento", { ascending: true });

      // Filtro por período de recebimento
      if (periodoInicio) {
        query = query.gte("data_recebimento", periodoInicio);
      }
      if (periodoFim) {
        query = query.lte("data_recebimento", periodoFim);
      }

      // Filtro por empresa
      if (empresaId && empresaId !== "todas") {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ContaReceber[];
    },
  });

  // Buscar todas as empresas para o filtro
  const { data: empresas } = useQuery({
    queryKey: ["empresas-fluxo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, razao_social, nome_fantasia")
        .eq("ativo", true)
        .order("razao_social");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Consolidar movimentos de todas as fontes
  const movimentos = useMemo<MovimentoCaixa[]>(() => {
    const items: MovimentoCaixa[] = [];

    // Processar transações de cartão (SAÍDAS)
    transacoesCartao?.forEach((tx: any) => {
      const empresa = tx.fatura?.cartao?.empresa;
      const empresaIdTx = empresa?.id;
      
      // Filtro por empresa se especificado
      if (empresaId && empresaId !== "todas" && empresaIdTx !== empresaId) {
        return;
      }

      items.push({
        id: `cartao-${tx.id}`,
        data: tx.data_transacao,
        tipo: "saida", // Transações de cartão são sempre saídas
        origem: "cartao",
        descricao: tx.descricao,
        categoriaId: tx.categoria_id,
        categoriaNome: tx.categoria?.nome || null,
        categoriaTipo: tx.categoria?.tipo || null,
        centroCustoId: tx.centro_custo_id,
        centroCustoNome: tx.centro_custo?.nome || null,
        valor: Math.abs(tx.valor), // Valor sempre positivo, tipo indica direção
        empresaId: empresaIdTx || null,
        empresaNome: empresa?.nome_fantasia || empresa?.razao_social || null,
        cartaoNome: tx.fatura?.cartao?.nome || null,
        status: tx.status,
      });
    });

    // Processar contas a pagar pagas (SAÍDAS)
    contasPagas?.forEach((conta: any) => {
      items.push({
        id: `cp-${conta.id}`,
        data: conta.data_pagamento,
        tipo: "saida", // Contas a pagar são sempre saídas
        origem: "contas_pagar",
        descricao: conta.descricao,
        categoriaId: conta.categoria_id,
        categoriaNome: conta.categoria?.nome || null,
        categoriaTipo: conta.categoria?.tipo || null,
        centroCustoId: conta.centro_custo_id,
        centroCustoNome: conta.centro_custo?.nome || null,
        valor: Math.abs(conta.valor_pago), // Valor efetivamente pago
        empresaId: conta.empresa_id,
        empresaNome: conta.empresa?.nome_fantasia || conta.empresa?.razao_social || null,
        fornecedorNome: conta.fornecedor_nome,
        status: conta.status,
      });
    });

    // Processar contas a receber recebidas (ENTRADAS)
    contasRecebidas?.forEach((conta) => {
      if (!conta.data_recebimento) return;
      
      items.push({
        id: `cr-${conta.id}`,
        data: conta.data_recebimento,
        tipo: "entrada", // Contas a receber são sempre entradas
        origem: "contas_receber",
        descricao: conta.descricao,
        categoriaId: conta.categoria_id,
        categoriaNome: conta.categoria?.nome || null,
        categoriaTipo: conta.categoria?.tipo || null,
        centroCustoId: conta.centro_custo_id,
        centroCustoNome: conta.centro_custo?.nome || null,
        valor: Math.abs(conta.valor_recebido), // Valor efetivamente recebido
        empresaId: conta.empresa_id,
        empresaNome: conta.empresa?.nome_fantasia || conta.empresa?.razao_social || null,
        fornecedorNome: conta.cliente_nome, // Usamos como "cliente" aqui
        status: conta.status,
      });
    });

    // TODO: Adicionar transações bancárias (quando tabela existir)

    // Ordenar por data (mais antiga primeiro para cálculo de saldo acumulado)
    return items.sort((a, b) => a.data.localeCompare(b.data));
  }, [transacoesCartao, contasPagas, contasRecebidas, empresaId]);

  // Calcular resumo
  const resumo = useMemo<FluxoCaixaResumo>(() => {
    const totalEntradas = movimentos
      .filter((m) => m.tipo === "entrada")
      .reduce((acc, m) => acc + m.valor, 0);

    const totalSaidas = movimentos
      .filter((m) => m.tipo === "saida")
      .reduce((acc, m) => acc + m.valor, 0);

    // Saldo inicial: por enquanto assumimos zero (futuramente virá de configuração ou período anterior)
    const saldoInicial = 0;
    const saldoFinal = saldoInicial + totalEntradas - totalSaidas;

    // Projeção 30 dias: média diária de saídas * 30 (simplificado)
    // TODO: Melhorar com contas a pagar em aberto
    const diasNoPeriodo = movimentos.length > 0 ? 
      Math.max(1, Math.ceil((new Date(movimentos[movimentos.length - 1]?.data).getTime() - new Date(movimentos[0]?.data).getTime()) / (1000 * 60 * 60 * 24))) : 1;
    const mediaDiariaSaidas = totalSaidas / diasNoPeriodo;
    const projecao30Dias = saldoFinal - (mediaDiariaSaidas * 30);

    return {
      saldoInicial,
      totalEntradas,
      totalSaidas,
      saldoFinal,
      projecao30Dias,
    };
  }, [movimentos]);

  // Dados agregados para dashboard
  const agregado = useMemo<FluxoCaixaAgregado>(() => {
    // Agrupar por dia
    const porDiaMap = new Map<string, { entradas: number; saidas: number }>();
    movimentos.forEach((m) => {
      const existing = porDiaMap.get(m.data) || { entradas: 0, saidas: 0 };
      if (m.tipo === "entrada") {
        existing.entradas += m.valor;
      } else {
        existing.saidas += m.valor;
      }
      porDiaMap.set(m.data, existing);
    });

    // Converter para array com saldo acumulado
    let saldoAcumulado = 0;
    const porDia = Array.from(porDiaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, values]) => {
        const saldo = values.entradas - values.saidas;
        saldoAcumulado += saldo;
        return {
          data,
          entradas: values.entradas,
          saidas: values.saidas,
          saldo,
          saldoAcumulado,
        };
      });

    // Agrupar por categoria (apenas saídas para o gráfico principal)
    const porCategoriaMap = new Map<string, { tipo: string; valor: number }>();
    movimentos
      .filter((m) => m.tipo === "saida")
      .forEach((m) => {
        const key = m.categoriaNome || "Não categorizado";
        const existing = porCategoriaMap.get(key) || { tipo: m.categoriaTipo || "", valor: 0 };
        existing.valor += m.valor;
        porCategoriaMap.set(key, existing);
      });

    const porCategoria = Array.from(porCategoriaMap.entries())
      .map(([categoria, { tipo, valor }]) => ({ categoria, tipo, valor }))
      .sort((a, b) => b.valor - a.valor);

    // Agrupar por centro de custo
    const porCCMap = new Map<string, number>();
    movimentos
      .filter((m) => m.tipo === "saida")
      .forEach((m) => {
        const key = m.centroCustoNome || "Sem centro de custo";
        porCCMap.set(key, (porCCMap.get(key) || 0) + m.valor);
      });

    const porCentroCusto = Array.from(porCCMap.entries())
      .map(([centroCusto, valor]) => ({ centroCusto, valor }))
      .sort((a, b) => b.valor - a.valor);

    return {
      porDia,
      porCategoria,
      porCentroCusto,
    };
  }, [movimentos]);

  return {
    movimentos,
    resumo,
    agregado,
    empresas,
    isLoading: loadingCartao || loadingContas || loadingReceber,
    hasData: movimentos.length > 0,
  };
};
