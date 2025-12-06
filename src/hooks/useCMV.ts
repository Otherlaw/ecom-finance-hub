/**
 * Hook para gerenciamento de registros de CMV (Custo de Mercadoria Vendida).
 * Compatível com nova estrutura V2.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export interface CMVRegistro {
  id: string;
  empresa_id: string;
  produto_id: string;
  armazem_id: string | null;
  data: string;
  origem: string;
  canal: string | null;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
  preco_venda_unitario: number | null;
  receita_total: number | null;
  margem_bruta: number | null;
  margem_percentual: number | null;
  referencia_id: string | null;
  observacoes: string | null;
  created_at: string;
  // Joins
  produto?: {
    id: string;
    nome: string;
    sku: string;
    categoria: string | null;
  } | null;
}

export interface UseCMVParams {
  empresaId?: string;
  produtoId?: string;
  armazemId?: string;
  dataInicio?: string;
  dataFim?: string;
  canal?: string;
  origem?: string;
}

// ============= HOOK PRINCIPAL =============

export function useCMV(params: UseCMVParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, produtoId, armazemId, dataInicio, dataFim, canal, origem } = params;

  const {
    data: registros = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["cmv_registros", empresaId, produtoId, armazemId, dataInicio, dataFim, canal, origem],
    queryFn: async () => {
      let query = supabase
        .from("cmv_registros")
        .select(`
          *,
          produto:produtos(id, nome, sku, categoria)
        `)
        .order("data", { ascending: false });

      if (empresaId) query = query.eq("empresa_id", empresaId);
      if (produtoId) query = query.eq("produto_id", produtoId);
      if (armazemId) query = query.eq("armazem_id", armazemId);
      if (dataInicio) query = query.gte("data", dataInicio);
      if (dataFim) query = query.lte("data", dataFim);
      if (canal) query = query.eq("canal", canal);
      if (origem) query = query.eq("origem", origem);

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar CMV:", error);
        throw error;
      }

      return (data || []).map((r): CMVRegistro => ({
        id: r.id,
        empresa_id: r.empresa_id,
        produto_id: r.produto_id,
        armazem_id: r.armazem_id,
        data: r.data,
        origem: r.origem,
        canal: r.canal,
        quantidade: Number(r.quantidade) || 0,
        custo_unitario: Number(r.custo_unitario) || 0,
        custo_total: Number(r.custo_total) || 0,
        preco_venda_unitario: r.preco_venda_unitario ? Number(r.preco_venda_unitario) : null,
        receita_total: r.receita_total ? Number(r.receita_total) : null,
        margem_bruta: r.margem_bruta ? Number(r.margem_bruta) : null,
        margem_percentual: r.margem_percentual ? Number(r.margem_percentual) : null,
        referencia_id: r.referencia_id,
        observacoes: r.observacoes,
        created_at: r.created_at,
        produto: r.produto as CMVRegistro["produto"],
      }));
    },
  });

  // Registrar venda manualmente
  const registrarVenda = useMutation({
    mutationFn: async (input: {
      empresaId: string;
      produtoId: string;
      armazemId?: string;
      quantidade: number;
      custoUnitario: number;
      data: string;
      canal?: string;
      precoVendaUnitario?: number;
      receitaTotal?: number;
      referenciaId?: string;
      observacoes?: string;
    }) => {
      const custoTotal = input.quantidade * input.custoUnitario;
      const receitaTotal = input.receitaTotal || (input.precoVendaUnitario ? input.quantidade * input.precoVendaUnitario : null);
      const margemBruta = receitaTotal ? receitaTotal - custoTotal : null;
      const margemPercentual = receitaTotal && receitaTotal > 0 ? (margemBruta! / receitaTotal) * 100 : null;

      const { data, error } = await supabase
        .from("cmv_registros")
        .insert({
          empresa_id: input.empresaId,
          produto_id: input.produtoId,
          armazem_id: input.armazemId || null,
          data: input.data,
          origem: "manual",
          canal: input.canal || null,
          quantidade: input.quantidade,
          custo_unitario: input.custoUnitario,
          custo_total: custoTotal,
          preco_venda_unitario: input.precoVendaUnitario || null,
          receita_total: receitaTotal,
          margem_bruta: margemBruta,
          margem_percentual: margemPercentual,
          referencia_id: input.referenciaId || null,
          observacoes: input.observacoes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Venda registrada e CMV calculado");
      queryClient.invalidateQueries({ queryKey: ["cmv_registros"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar venda:", error);
      toast.error(`Erro ao registrar venda: ${error.message}`);
    },
  });

  // Resumo calculado
  const resumo = {
    totalCMV: registros.reduce((sum, r) => sum + r.custo_total, 0),
    totalReceita: registros.reduce((sum, r) => sum + (r.receita_total || 0), 0),
    margemBrutaTotal: registros.reduce((sum, r) => sum + (r.margem_bruta || 0), 0),
    quantidadeVendida: registros.reduce((sum, r) => sum + r.quantidade, 0),
    registros: registros.length,
    margemPercentualMedia: 0,
  };

  if (resumo.totalReceita > 0) {
    resumo.margemPercentualMedia = (resumo.margemBrutaTotal / resumo.totalReceita) * 100;
  }

  return {
    registros,
    isLoading,
    refetch,
    resumo,
    registrarVenda,
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
          produto:produtos(id, nome, sku, categoria, custo_medio)
        `)
        .eq("empresa_id", empresaId!);

      if (dataInicio) query = query.gte("data", dataInicio);
      if (dataFim) query = query.lte("data", dataFim);

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar CMV por produto:", error);
        throw error;
      }

      // Agrupar por produto
      const porProduto = new Map<string, {
        produto: { id: string; nome: string; sku: string; categoria: string | null; custo_medio: number };
        quantidade: number;
        custoTotal: number;
        receitaTotal: number;
        margemBruta: number;
        vendas: number;
      }>();

      (data || []).forEach((r: any) => {
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
              id: r.produto?.id || produtoId,
              nome: r.produto?.nome || "Produto não encontrado",
              sku: r.produto?.sku || "",
              categoria: r.produto?.categoria || null,
              custo_medio: Number(r.produto?.custo_medio) || 0,
            },
            quantidade: Number(r.quantidade) || 0,
            custoTotal: Number(r.custo_total) || 0,
            receitaTotal: Number(r.receita_total) || 0,
            margemBruta: Number(r.margem_bruta) || 0,
            vendas: 1,
          });
        }
      });

      return Array.from(porProduto.values()).map((item) => ({
        ...item,
        margemPercentual: item.receitaTotal > 0 ? (item.margemBruta / item.receitaTotal) * 100 : 0,
      })).sort((a, b) => b.receitaTotal - a.receitaTotal);
    },
  });
}
