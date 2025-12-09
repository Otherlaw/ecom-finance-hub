/**
 * Hook para gerenciamento de produtos - Nova Estrutura V2
 * Suporta: único, variation_parent, variation_child, kit
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export type TipoProduto = 'unico' | 'variation_parent' | 'variation_child' | 'kit';
export type StatusProduto = 'ativo' | 'inativo' | 'rascunho';

export interface Produto {
  id: string;
  empresa_id: string;
  sku: string;
  nome: string;
  descricao: string | null;
  tipo: TipoProduto;
  parent_id: string | null;
  atributos_variacao: Record<string, string>;
  kit_componentes: Array<{ sku: string; quantidade: number }>;
  ncm: string | null;
  cfop_venda: string | null;
  cfop_compra: string | null;
  situacao_tributaria: string | null;
  custo_medio: number;
  preco_venda: number;
  peso_kg: number;
  altura_cm: number;
  largura_cm: number;
  profundidade_cm: number;
  categoria: string | null;
  subcategoria: string | null;
  marca: string | null;
  unidade_medida: string;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  status: StatusProduto;
  imagem_url: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  parent?: Produto | null;
  variacoes?: Produto[];
}

export interface ProdutoInsert {
  empresa_id: string;
  sku: string;
  nome: string;
  descricao?: string;
  tipo?: TipoProduto;
  parent_id?: string;
  atributos_variacao?: Record<string, string>;
  kit_componentes?: Array<{ sku: string; quantidade: number }>;
  ncm?: string;
  cfop_venda?: string;
  cfop_compra?: string;
  situacao_tributaria?: string;
  custo_medio?: number;
  preco_venda?: number;
  peso_kg?: number;
  altura_cm?: number;
  largura_cm?: number;
  profundidade_cm?: number;
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  unidade_medida?: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  status?: StatusProduto;
  imagem_url?: string;
}

export interface ProdutoUpdate extends Partial<ProdutoInsert> {
  id: string;
}

export interface UseProdutosParams {
  empresaId?: string;
  status?: StatusProduto | "todos";
  tipo?: TipoProduto | "todos";
  categoria?: string;
  busca?: string;
  apenasRaiz?: boolean; // Excluir variation_child
}

// ============= HOOK PRINCIPAL =============

export function useProdutos(params: UseProdutosParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, status = "todos", tipo = "todos", categoria, busca, apenasRaiz = true } = params;

  const {
    data: produtos = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["produtos", empresaId, status, tipo, categoria, busca, apenasRaiz],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("*")
        .order("nome", { ascending: true });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      if (status && status !== "todos") {
        query = query.eq("status", status);
      }

      if (tipo && tipo !== "todos") {
        query = query.eq("tipo", tipo);
      }

      if (apenasRaiz) {
        query = query.neq("tipo", "variation_child");
      }

      if (categoria) {
        query = query.eq("categoria", categoria);
      }

      if (busca) {
        query = query.or(`nome.ilike.%${busca}%,sku.ilike.%${busca}%,ncm.ilike.%${busca}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar produtos:", error);
        throw error;
      }

      return (data || []).map((p): Produto => ({
        id: p.id,
        empresa_id: p.empresa_id,
        sku: p.sku,
        nome: p.nome,
        descricao: p.descricao,
        tipo: p.tipo as TipoProduto,
        parent_id: p.parent_id,
        atributos_variacao: (p.atributos_variacao as Record<string, string>) || {},
        kit_componentes: (p.kit_componentes as Array<{ sku: string; quantidade: number }>) || [],
        ncm: p.ncm,
        cfop_venda: p.cfop_venda,
        cfop_compra: p.cfop_compra,
        situacao_tributaria: p.situacao_tributaria,
        custo_medio: Number(p.custo_medio) || 0,
        preco_venda: Number(p.preco_venda) || 0,
        peso_kg: Number(p.peso_kg) || 0,
        altura_cm: Number(p.altura_cm) || 0,
        largura_cm: Number(p.largura_cm) || 0,
        profundidade_cm: Number(p.profundidade_cm) || 0,
        categoria: p.categoria,
        subcategoria: p.subcategoria,
        marca: p.marca,
        unidade_medida: p.unidade_medida,
        fornecedor_id: p.fornecedor_id,
        fornecedor_nome: p.fornecedor_nome,
        status: p.status as StatusProduto,
        imagem_url: p.imagem_url || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
    },
  });

  // Criar produto
  const criarProduto = useMutation({
    mutationFn: async (input: ProdutoInsert) => {
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          empresa_id: input.empresa_id,
          sku: input.sku,
          nome: input.nome,
          descricao: input.descricao || null,
          tipo: input.tipo || "unico",
          parent_id: input.parent_id || null,
          atributos_variacao: input.atributos_variacao || {},
          kit_componentes: input.kit_componentes || [],
          ncm: input.ncm || null,
          cfop_venda: input.cfop_venda || null,
          cfop_compra: input.cfop_compra || null,
          situacao_tributaria: input.situacao_tributaria || null,
          custo_medio: input.custo_medio || 0,
          preco_venda: input.preco_venda || 0,
          peso_kg: input.peso_kg || 0,
          altura_cm: input.altura_cm || 0,
          largura_cm: input.largura_cm || 0,
          profundidade_cm: input.profundidade_cm || 0,
          categoria: input.categoria || null,
          subcategoria: input.subcategoria || null,
          marca: input.marca || null,
          unidade_medida: input.unidade_medida || "un",
          fornecedor_id: input.fornecedor_id || null,
          fornecedor_nome: input.fornecedor_nome || null,
          status: input.status || "ativo",
          imagem_url: input.imagem_url || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Produto criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar produto:", error);
      toast.error(`Erro ao criar produto: ${error.message}`);
    },
  });

  // Atualizar produto
  const atualizarProduto = useMutation({
    mutationFn: async (input: ProdutoUpdate) => {
      const { id, ...restData } = input;

      // Verificar se está ativando um produto rascunho
      const { data: produtoAtual } = await supabase
        .from("produtos")
        .select("status, empresa_id")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("produtos")
        .update(restData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Se o produto estava como rascunho e foi ativado, vincular aos itens de compras pendentes
      if (produtoAtual?.status === "rascunho" && restData.status === "ativo") {
        // Buscar itens de compra que foram criados com esse produto (já vinculados)
        const { data: itensVinculados } = await supabase
          .from("compras_itens")
          .select("id, compra_id, quantidade, quantidade_recebida, valor_unitario")
          .eq("produto_id", id);

        // Para cada item que já foi recebido mas não deu entrada no estoque
        if (itensVinculados && itensVinculados.length > 0) {
          for (const item of itensVinculados) {
            if (item.quantidade_recebida > 0) {
              // Buscar dados do recebimento
              const { data: recebimentoItem } = await supabase
                .from("recebimentos_itens")
                .select("recebimento_id, custo_unitario, recebimentos!inner(armazem_id)")
                .eq("compra_item_id", item.id)
                .maybeSingle();

              if (recebimentoItem) {
                const armazemId = (recebimentoItem.recebimentos as any)?.armazem_id;
                const custoUnitario = recebimentoItem.custo_unitario || item.valor_unitario;

                if (armazemId) {
                  // Buscar estoque atual
                  const { data: estoqueAtual } = await supabase
                    .from("estoque")
                    .select("*")
                    .eq("produto_id", id)
                    .eq("armazem_id", armazemId)
                    .maybeSingle();

                  const qtdAnterior = Number(estoqueAtual?.quantidade) || 0;
                  const custoMedioAnterior = Number(estoqueAtual?.custo_medio) || 0;
                  const qtdNova = qtdAnterior + item.quantidade_recebida;

                  // Custo médio ponderado
                  const valorAnterior = qtdAnterior * custoMedioAnterior;
                  const valorEntrada = item.quantidade_recebida * custoUnitario;
                  const novoCustoMedio = qtdNova > 0 ? (valorAnterior + valorEntrada) / qtdNova : custoUnitario;

                  // Upsert estoque
                  if (estoqueAtual) {
                    await supabase
                      .from("estoque")
                      .update({ quantidade: qtdNova, custo_medio: novoCustoMedio })
                      .eq("id", estoqueAtual.id);
                  } else {
                    await supabase.from("estoque").insert({
                      empresa_id: produtoAtual.empresa_id,
                      produto_id: id,
                      armazem_id: armazemId,
                      quantidade: qtdNova,
                      custo_medio: novoCustoMedio,
                    });
                  }

                  // Registrar movimentação
                  await supabase.from("movimentacoes_estoque").insert({
                    empresa_id: produtoAtual.empresa_id,
                    produto_id: id,
                    armazem_id: armazemId,
                    tipo: "entrada",
                    origem: "compra",
                    motivo: "Entrada automática após conclusão de cadastro",
                    quantidade: item.quantidade_recebida,
                    custo_unitario: custoUnitario,
                    custo_total: item.quantidade_recebida * custoUnitario,
                    estoque_anterior: qtdAnterior,
                    estoque_posterior: qtdNova,
                    custo_medio_anterior: custoMedioAnterior,
                    custo_medio_posterior: novoCustoMedio,
                    referencia_id: item.compra_id,
                  });
                }
              }
            }
          }
          
          // Marcar itens como mapeados
          await supabase
            .from("compras_itens")
            .update({ mapeado: true })
            .eq("produto_id", id);
        }
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar produto:", error);
      toast.error(`Erro ao atualizar produto: ${error.message}`);
    },
  });

  // Excluir produto
  const excluirProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao excluir produto:", error);
      toast.error(`Erro ao excluir produto: ${error.message}`);
    },
  });

  // Inativar produto
  const inativarProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("produtos")
        .update({ status: "inativo" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto inativado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao inativar produto:", error);
      toast.error(`Erro ao inativar produto: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    total: produtos.length,
    ativos: produtos.filter((p) => p.status === "ativo").length,
    inativos: produtos.filter((p) => p.status === "inativo").length,
    rascunhos: produtos.filter((p) => p.status === "rascunho").length,
    unicos: produtos.filter((p) => p.tipo === "unico").length,
    pais: produtos.filter((p) => p.tipo === "variation_parent").length,
    kits: produtos.filter((p) => p.tipo === "kit").length,
  };

  return {
    produtos,
    isLoading,
    refetch,
    resumo,
    criarProduto,
    atualizarProduto,
    excluirProduto,
    inativarProduto,
  };
}

// ============= HOOK PARA BUSCAR PRODUTO ÚNICO =============

export function useProduto(id: string | null) {
  return useQuery({
    queryKey: ["produto", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao buscar produto:", error);
        throw error;
      }

      return {
        ...data,
        tipo: data.tipo as TipoProduto,
        atributos_variacao: (data.atributos_variacao as Record<string, string>) || {},
        kit_componentes: (data.kit_componentes as Array<{ sku: string; quantidade: number }>) || [],
        custo_medio: Number(data.custo_medio) || 0,
        preco_venda: Number(data.preco_venda) || 0,
        status: data.status as StatusProduto,
      } as Produto;
    },
  });
}

// ============= HOOK PARA VARIAÇÕES =============

export function useVariacoesProduto(parentId: string | null) {
  return useQuery({
    queryKey: ["variacoes", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      if (!parentId) return [];

      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("parent_id", parentId)
        .eq("tipo", "variation_child")
        .order("sku");

      if (error) throw error;

      return (data || []).map((p): Produto => ({
        ...p,
        tipo: p.tipo as TipoProduto,
        atributos_variacao: (p.atributos_variacao as Record<string, string>) || {},
        kit_componentes: [],
        custo_medio: Number(p.custo_medio) || 0,
        preco_venda: Number(p.preco_venda) || 0,
        status: p.status as StatusProduto,
      }));
    },
  });
}
