/**
 * Hook para gerenciamento de registros de CMV (Custo de Mercadoria Vendida).
 * Suporta controle por Produto ou por SKU (Motor de Estoque V1).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CMVRegistro, Produto } from "@/lib/motor-custos";
import { registrarSaidaEstoque, buscarResumoCMV } from "@/lib/motor-custos";
import { registrarSaidaEstoqueSKU, type SaidaEstoqueSKUInput } from "@/lib/motor-estoque-sku";

// ============= TIPOS =============

export interface UseCMVParams {
  empresaId?: string;
  produtoId?: string;
  skuId?: string;
  dataInicio?: string;
  dataFim?: string;
  canal?: string;
  origem?: "marketplace" | "manual" | "ajuste" | "devolucao";
}

export interface CMVRegistroComProduto extends Omit<CMVRegistro, "produto"> {
  sku_id?: string | null;
  sku?: {
    id: string;
    codigo_sku: string;
    variacao: Record<string, string>;
  } | null;
  produto: {
    id: string;
    nome: string;
    codigo_interno: string;
    categoria: string | null;
  } | null;
}

// ============= HOOK PRINCIPAL =============

export function useCMV(params: UseCMVParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, produtoId, skuId, dataInicio, dataFim, canal, origem } = params;

  // Query de registros de CMV
  const {
    data: registros = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["cmv_registros", empresaId, produtoId, skuId, dataInicio, dataFim, canal, origem],
    queryFn: async () => {
      let query = supabase
        .from("cmv_registros")
        .select(`
          *,
          produto:produtos(id, nome, codigo_interno, categoria),
          sku:produto_skus(id, codigo_sku, variacao)
        `)
        .order("data", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      if (produtoId) {
        query = query.eq("produto_id", produtoId);
      }

      if (skuId) {
        query = query.eq("sku_id", skuId);
      }

      if (dataInicio) {
        query = query.gte("data", dataInicio);
      }

      if (dataFim) {
        query = query.lte("data", dataFim);
      }

      if (canal) {
        query = query.eq("canal", canal);
      }

      if (origem) {
        query = query.eq("origem", origem);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar CMV:", error);
        throw error;
      }

      return (data || []).map((r): CMVRegistroComProduto => ({
        id: r.id,
        empresa_id: r.empresa_id,
        produto_id: r.produto_id,
        sku_id: r.sku_id,
        origem: r.origem as CMVRegistro["origem"],
        referencia_id: r.referencia_id,
        data: r.data,
        quantidade: Number(r.quantidade) || 0,
        custo_unitario_momento: Number(r.custo_unitario_momento) || 0,
        custo_total: Number(r.custo_total) || 0,
        preco_venda_unitario: r.preco_venda_unitario ? Number(r.preco_venda_unitario) : undefined,
        receita_total: r.receita_total ? Number(r.receita_total) : undefined,
        margem_bruta: r.margem_bruta ? Number(r.margem_bruta) : undefined,
        margem_percentual: r.margem_percentual ? Number(r.margem_percentual) : undefined,
        canal: r.canal,
        observacoes: r.observacoes,
        created_at: r.created_at,
        sku: r.sku as CMVRegistroComProduto["sku"],
        produto: r.produto as CMVRegistroComProduto["produto"],
      }));
    },
  });

  // Query de resumo de CMV
  const {
    data: resumo,
    isLoading: isLoadingResumo,
  } = useQuery({
    queryKey: ["cmv_resumo", empresaId, dataInicio, dataFim],
    enabled: !!empresaId && !!dataInicio && !!dataFim,
    queryFn: async () => {
      if (!empresaId || !dataInicio || !dataFim) return null;
      return buscarResumoCMV(empresaId, dataInicio, dataFim);
    },
  });

  // Registrar venda manualmente (gera CMV) - por Produto
  const registrarVenda = useMutation({
    mutationFn: async (input: {
      produtoId: string;
      empresaId: string;
      quantidade: number;
      data: string;
      precoVendaUnitario?: number;
      receitaTotal?: number;
      canal?: string;
      observacoes?: string;
    }) => {
      return registrarSaidaEstoque({
        produtoId: input.produtoId,
        empresaId: input.empresaId,
        quantidade: input.quantidade,
        origem: "manual",
        data: input.data,
        precoVendaUnitario: input.precoVendaUnitario,
        receitaTotal: input.receitaTotal,
        canal: input.canal,
        observacoes: input.observacoes,
      });
    },
    onSuccess: () => {
      toast.success("Venda registrada e CMV calculado");
      queryClient.invalidateQueries({ queryKey: ["cmv_registros"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_resumo"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar venda:", error);
      toast.error(`Erro ao registrar venda: ${error.message}`);
    },
  });

  // Registrar venda por SKU (Motor de Estoque V1)
  const registrarVendaSKU = useMutation({
    mutationFn: async (input: Omit<SaidaEstoqueSKUInput, "origem"> & { origem?: SaidaEstoqueSKUInput["origem"] }) => {
      return registrarSaidaEstoqueSKU({
        ...input,
        origem: input.origem || "manual",
      });
    },
    onSuccess: () => {
      toast.success("Venda (SKU) registrada e CMV calculado");
      queryClient.invalidateQueries({ queryKey: ["cmv_registros"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_resumo"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar venda SKU:", error);
      toast.error(`Erro ao registrar venda: ${error.message}`);
    },
  });

  // Resumo calculado localmente (para quando não temos período definido)
  const resumoLocal = {
    totalCMV: registros.reduce((sum, r) => sum + r.custo_total, 0),
    totalReceita: registros.reduce((sum, r) => sum + (r.receita_total || 0), 0),
    margemBrutaTotal: registros.reduce((sum, r) => sum + (r.margem_bruta || 0), 0),
    quantidadeVendida: registros.reduce((sum, r) => sum + r.quantidade, 0),
    registros: registros.length,
    margemPercentualMedia: 0,
  };

  if (resumoLocal.totalReceita > 0) {
    resumoLocal.margemPercentualMedia = (resumoLocal.margemBrutaTotal / resumoLocal.totalReceita) * 100;
  }

  return {
    registros,
    isLoading,
    refetch,
    resumo: resumo || resumoLocal,
    isLoadingResumo,
    // Operações por Produto (legado)
    registrarVenda,
    // Operações por SKU (Motor V1)
    registrarVendaSKU,
  };
}

// ============= HOOK PARA CMV POR PRODUTO =============

export function useCMVPorProduto(params: UseCMVParams = {}) {
  const { empresaId, dataInicio, dataFim } = params;

  return useQuery({
    queryKey: ["cmv_por_produto", empresaId, dataInicio, dataFim],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("cmv_registros")
        .select(`
          produto_id,
          quantidade,
          custo_total,
          receita_total,
          margem_bruta,
          produto:produtos(id, nome, codigo_interno, categoria, custo_medio_atual)
        `)
        .eq("empresa_id", empresaId!);

      if (dataInicio) {
        query = query.gte("data", dataInicio);
      }

      if (dataFim) {
        query = query.lte("data", dataFim);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar CMV por produto:", error);
        throw error;
      }

      // Agrupar por produto
      const porProduto = new Map<string, {
        produto: { id: string; nome: string; codigo_interno: string; categoria: string | null; custo_medio_atual: number };
        quantidade: number;
        custoTotal: number;
        receitaTotal: number;
        margemBruta: number;
        vendas: number;
      }>();

      (data || []).forEach((r) => {
        const produtoId = r.produto_id;
        const existing = porProduto.get(produtoId);

        if (existing) {
          existing.quantidade += Number(r.quantidade) || 0;
          existing.custoTotal += Number(r.custo_total) || 0;
          existing.receitaTotal += Number(r.receita_total) || 0;
          existing.margemBruta += Number(r.margem_bruta) || 0;
          existing.vendas += 1;
        } else {
          porProduto.set(produtoId, {
            produto: {
              id: (r.produto as any)?.id || produtoId,
              nome: (r.produto as any)?.nome || "Produto não encontrado",
              codigo_interno: (r.produto as any)?.codigo_interno || "",
              categoria: (r.produto as any)?.categoria || null,
              custo_medio_atual: Number((r.produto as any)?.custo_medio_atual) || 0,
            },
            quantidade: Number(r.quantidade) || 0,
            custoTotal: Number(r.custo_total) || 0,
            receitaTotal: Number(r.receita_total) || 0,
            margemBruta: Number(r.margem_bruta) || 0,
            vendas: 1,
          });
        }
      });

      // Converter para array e calcular margem percentual
      return Array.from(porProduto.values()).map((item) => ({
        ...item,
        margemPercentual: item.receitaTotal > 0 ? (item.margemBruta / item.receitaTotal) * 100 : 0,
      })).sort((a, b) => b.receitaTotal - a.receitaTotal);
    },
  });
}
