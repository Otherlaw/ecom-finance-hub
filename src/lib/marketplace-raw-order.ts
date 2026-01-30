export type MarketplaceDraftItem = {
  sku_marketplace: string | null;
  anuncio_id: string | null;
  variante_id: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number;
};

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v;
  if (typeof v === "number") return String(v);
  return null;
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/**
 * Extrai itens de um payload bruto do Mercado Livre (raw_order).
 * Objetivo: permitir criar um rascunho de mapeamento quando os itens ainda não
 * foram persistidos em marketplace_transaction_items.
 */
export function extractMlDraftItemsFromRawOrder(rawOrder: unknown): MarketplaceDraftItem[] {
  if (!rawOrder || typeof rawOrder !== "object") return [];
  const anyOrder = rawOrder as any;

  const orderItems: any[] = Array.isArray(anyOrder.order_items)
    ? anyOrder.order_items
    : Array.isArray(anyOrder.items)
      ? anyOrder.items
      : [];

  if (orderItems.length === 0) return [];

  const items: MarketplaceDraftItem[] = orderItems.map((oi: any) => {
    const item = oi?.item ?? oi;

    const sku =
      asString(oi?.seller_custom_field) ||
      asString(oi?.seller_sku) ||
      asString(item?.seller_custom_field) ||
      asString(item?.seller_sku) ||
      null;

    const anuncioId = asString(item?.id) || asString(oi?.item_id) || null;
    const varianteId = asString(oi?.variation_id) || asString(item?.variation_id) || null;
    const titulo =
      asString(item?.title) ||
      asString(oi?.title) ||
      asString(oi?.item?.title) ||
      null;

    const quantidade = Math.max(1, asNumber(oi?.quantity ?? oi?.qty ?? 1, 1));
    const precoUnitario = asNumber(oi?.unit_price ?? oi?.price ?? item?.price ?? 0, 0);

    return {
      sku_marketplace: sku,
      anuncio_id: anuncioId,
      variante_id: varianteId,
      descricao_item: titulo,
      quantidade,
      preco_unitario: precoUnitario,
    };
  });

  // Só mantém itens minimamente úteis (título ou SKU)
  return items.filter((i) => !!i.descricao_item || !!i.sku_marketplace);
}
