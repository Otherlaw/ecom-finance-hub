import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipo para itens de uma venda/transação específica
 */
export interface VendaItem {
  id: string;
  transaction_id: string;
  sku_marketplace: string | null;
  anuncio_id: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  produto_id: string | null;
  // Dados do produto vinculado
  produto_sku: string | null;
  produto_nome: string | null;
  custo_medio: number;
  // Campos calculados
  custo_total: number;
  sem_produto: boolean;
  sem_custo: boolean;
  // Flag para indicar que veio do raw_order (não da tabela de itens)
  from_raw_order?: boolean;
}

// ---- Helpers de parsing do raw_order ----

type RawParsedItem = {
  id: string;
  sku_marketplace: string | null;
  anuncio_id: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
};

function parseRawOrderItems(rawOrder: any, transactionId: string): RawParsedItem[] {
  if (!rawOrder || typeof rawOrder !== "object") return [];

  const orderItems: any[] = Array.isArray(rawOrder.order_items)
    ? rawOrder.order_items
    : Array.isArray(rawOrder.items)
      ? rawOrder.items
      : [];

  if (orderItems.length === 0) return [];

  return orderItems.map((oi: any, index: number) => {
    const item = oi?.item ?? oi;
    const quantity = Math.max(1, oi?.quantity ?? oi?.qty ?? 1);
    const unitPrice = oi?.unit_price ?? oi?.price ?? item?.price ?? 0;

    return {
      id: `raw_${transactionId}_${index}`,
      sku_marketplace:
        oi?.seller_custom_field || oi?.seller_sku ||
        item?.seller_custom_field || item?.seller_sku || null,
      anuncio_id: item?.id ? String(item.id) : (oi?.item_id ? String(oi.item_id) : null),
      descricao_item: item?.title || oi?.title || null,
      quantidade: quantity,
      preco_unitario: unitPrice,
      preco_total: unitPrice * quantity,
    };
  });
}

function findMatchingDbItem(rawItem: RawParsedItem, dbItems: any[]): any | null {
  if (!dbItems || dbItems.length === 0) return null;

  if (rawItem.anuncio_id) {
    const match = dbItems.find((db: any) => db.anuncio_id && String(db.anuncio_id) === String(rawItem.anuncio_id));
    if (match) return match;
  }

  if (rawItem.sku_marketplace) {
    const match = dbItems.find((db: any) => db.sku_marketplace && db.sku_marketplace === rawItem.sku_marketplace);
    if (match) return match;
  }

  if (rawItem.descricao_item) {
    const rawDesc = rawItem.descricao_item.toLowerCase().trim();
    const match = dbItems.find((db: any) => db.descricao_item && db.descricao_item.toLowerCase().trim() === rawDesc);
    if (match) return match;
  }

  return null;
}

/**
 * Hook para carregar itens de transações de um pedido.
 * Aceita um array de transaction IDs (necessário para packs com múltiplas orders).
 * Faz merge raw_order + marketplace_transaction_items.
 */
export function useVendaItens(transactionIds: string[] | string | null) {
  const ids = transactionIds
    ? (Array.isArray(transactionIds) ? transactionIds : [transactionIds]).filter(Boolean)
    : [];

  const { data: itens, isLoading, error } = useQuery({
    queryKey: ["venda-itens", ...ids],
    queryFn: async () => {
      if (ids.length === 0) return [];

      // 1) Buscar itens do banco para TODAS as transactions
      const { data: itemsData, error: itemsError } = await supabase
        .from("marketplace_transaction_items")
        .select(`
          id,
          transaction_id,
          sku_marketplace,
          anuncio_id,
          descricao_item,
          quantidade,
          preco_unitario,
          preco_total,
          produto_id,
          produto:produtos!produto_id (
            id,
            sku,
            nome,
            custo_medio
          )
        `)
        .in("transaction_id", ids);

      if (itemsError) {
        console.error("Erro ao buscar itens da venda:", itemsError);
        throw itemsError;
      }

      // 2) Buscar raw_order de TODAS as transactions
      const { data: txDataArr } = await supabase
        .from("marketplace_transactions")
        .select("id, empresa_id, canal, raw_order")
        .in("id", ids);

      const transactions = txDataArr || [];
      const empresaId = transactions[0]?.empresa_id;

      // 3) Montar rawItems de TODOS os raw_orders
      const allRawItems: RawParsedItem[] = [];
      for (const tx of transactions) {
        const parsed = parseRawOrderItems(tx.raw_order, tx.id);
        allRawItems.push(...parsed);
      }

      const dbItems: any[] = itemsData || [];

      // 4) Merge: raw_order como base, enriquecido com dados do banco
      const usedDbIds = new Set<string>();
      let baseItems: Array<any & { from_raw_order: boolean }> = [];

      if (allRawItems.length > 0) {
        baseItems = allRawItems.map((rawItem) => {
          const dbMatch = findMatchingDbItem(rawItem, dbItems.filter((d: any) => !usedDbIds.has(d.id)));
          if (dbMatch) {
            usedDbIds.add(dbMatch.id);
            return {
              ...dbMatch,
              descricao_item: dbMatch.descricao_item || rawItem.descricao_item,
              quantidade: rawItem.quantidade,
              preco_unitario: rawItem.preco_unitario || dbMatch.preco_unitario || 0,
              preco_total: rawItem.preco_total || dbMatch.preco_total || 0,
              from_raw_order: false,
            };
          }
          return {
            id: rawItem.id,
            transaction_id: rawItem.id.split("_")[1] || ids[0],
            sku_marketplace: rawItem.sku_marketplace,
            anuncio_id: rawItem.anuncio_id,
            descricao_item: rawItem.descricao_item,
            quantidade: rawItem.quantidade,
            preco_unitario: rawItem.preco_unitario,
            preco_total: rawItem.preco_total,
            produto_id: null,
            produto: null,
            from_raw_order: true,
          };
        });

        // Anexar itens do banco sem match no raw_order
        for (const dbItem of dbItems) {
          if (!usedDbIds.has(dbItem.id)) {
            baseItems.push({ ...dbItem, from_raw_order: false });
          }
        }
      } else if (dbItems.length > 0) {
        baseItems = dbItems.map((d: any) => ({ ...d, from_raw_order: false }));
      }

      if (baseItems.length === 0) return [];

      // 5) Buscar mapeamentos e custos (mesma lógica existente)
      const skusSemProduto = baseItems
        .filter((item: any) => !item.produto_id && item.sku_marketplace)
        .map((item: any) => item.sku_marketplace);

      let mappingsMap: Record<string, { produto_id: string; custo_medio: number; produto_sku: string | null; produto_nome: string | null }> = {};
      if (skusSemProduto.length > 0 && empresaId) {
        const { data: mappings } = await supabase
          .from("produto_marketplace_map")
          .select(`
            sku_marketplace,
            produto_id,
            produto:produtos!produto_id (
              sku,
              nome,
              custo_medio
            )
          `)
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .in("sku_marketplace", skusSemProduto);

        if (mappings) {
          mappingsMap = mappings.reduce((acc: any, m: any) => {
            acc[m.sku_marketplace] = {
              produto_id: m.produto_id,
              custo_medio: m.produto?.custo_medio || 0,
              produto_sku: m.produto?.sku || null,
              produto_nome: m.produto?.nome || null,
            };
            return acc;
          }, {});
        }
      }

      let skuCostsMap: Record<string, number> = {};
      const skusSemMapeamento = skusSemProduto.filter((sku: string) => !mappingsMap[sku]);
      if (skusSemMapeamento.length > 0 && empresaId) {
        const { data: skuCosts } = await supabase
          .from("sku_costs")
          .select("sku, custo_unitario")
          .eq("empresa_id", empresaId)
          .in("sku", skusSemMapeamento);

        if (skuCosts) {
          skuCostsMap = skuCosts.reduce((acc: Record<string, number>, sc: any) => {
            acc[sc.sku] = sc.custo_unitario || 0;
            return acc;
          }, {});
        }
      }

      // 6) Transformar com hierarquia de custo
      const itensTransformados: VendaItem[] = baseItems.map((item: any) => {
        const produto = item.produto;
        const quantidade = item.quantidade || 1;
        const sku = item.sku_marketplace;

        let custoMedio = 0;
        let produtoId = item.produto_id;
        let produtoSku = produto?.sku || null;
        let produtoNome = produto?.nome || null;

        if (produto?.custo_medio && produto.custo_medio > 0) {
          custoMedio = produto.custo_medio;
        } else if (sku && mappingsMap[sku]) {
          custoMedio = mappingsMap[sku].custo_medio;
          produtoSku = mappingsMap[sku].produto_sku;
          produtoNome = mappingsMap[sku].produto_nome;
          if (!produtoId) produtoId = mappingsMap[sku].produto_id;
        } else if (sku && skuCostsMap[sku]) {
          custoMedio = skuCostsMap[sku];
        }

        const semCusto = custoMedio === 0;
        const semProduto = !produtoId && !(sku && mappingsMap[sku]);

        return {
          id: item.id,
          transaction_id: item.transaction_id || ids[0],
          sku_marketplace: sku,
          anuncio_id: item.anuncio_id,
          descricao_item: item.descricao_item,
          quantidade,
          preco_unitario: item.preco_unitario || 0,
          preco_total: item.preco_total || 0,
          produto_id: produtoId,
          produto_sku: produtoSku,
          produto_nome: produtoNome,
          custo_medio: custoMedio,
          custo_total: custoMedio * quantidade,
          sem_produto: semProduto,
          sem_custo: semCusto,
          from_raw_order: item.from_raw_order ?? false,
        };
      });

      return itensTransformados;
    },
    enabled: ids.length > 0,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    itens: itens || [],
    isLoading,
    error,
  };
}
