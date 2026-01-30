

# Plano: Adicionar Visão Consolidada e Individual ao Top 10 Produtos

## Diagnóstico Realizado

### O que está funcionando
A RPC `get_top_produtos_vendidos` está retornando **corretamente** os dados com custos:
- `CO-VG-PS4-PR` → custo R$ 42,00
- `02-JO-OR-UN` → custo R$ 11,40
- `LA-LE-VE-BI` → custo R$ 26,00
- Lucro e margem estão sendo calculados corretamente

### Problema identificado
Quando o filtro de empresa está em **"Todas as empresas"**, a seção Top 10 fica vazia porque:
1. O código atual exige `empresaIdFiltro` para chamar a RPC
2. A RPC não suporta consulta consolidada (p_empresa_id = NULL)

## Solução em 2 Etapas

### Etapa 1: Atualizar RPC para Suportar Visão Consolidada

**Arquivo:** `supabase/migrations/[nova]_update_top_produtos_consolidado.sql`

Modificar a RPC `get_top_produtos_vendidos` para:
- Quando `p_empresa_id = NULL` → retornar produtos de todas as empresas
- Quando `p_empresa_id` informado → filtrar pela empresa específica

```sql
CREATE OR REPLACE FUNCTION public.get_top_produtos_vendidos(
  p_empresa_id uuid,  -- NULL = todas as empresas
  p_data_inicio date,
  p_data_fim date,
  p_limite integer DEFAULT 10
)
RETURNS TABLE(...)
AS $$
BEGIN
  RETURN QUERY
  WITH vendas_items AS (
    SELECT ...
    FROM marketplace_transaction_items mti
    INNER JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    ...
    WHERE 
      -- Se p_empresa_id NULL = todas, senão filtra
      (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim
  )
  ...
```

### Etapa 2: Atualizar Dashboard.tsx para Suportar Ambas as Visões

**Arquivo:** `src/pages/Dashboard.tsx`

1. Remover a restrição que bloqueia a consulta quando `empresaIdFiltro` é undefined
2. Passar `p_empresa_id: null` quando "Todas as empresas" está selecionado
3. Manter alerta informativo quando visão consolidada está ativa

```typescript
// Query para Top 10 produtos mais vendidos - suporta consolidado e individual
const {
  data: topProdutosRaw = [],
  isLoading: isTopProdutosLoading
} = useQuery({
  queryKey: ["top-produtos-vendidos", empresaIdFiltro, periodoInicio, periodoFim],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_top_produtos_vendidos", {
      p_empresa_id: empresaIdFiltro || null,  // NULL = consolidado
      p_data_inicio: periodoInicio,
      p_data_fim: periodoFim,
      p_limite: 10
    });
    
    if (error) {
      console.error("Erro ao buscar top produtos:", error);
      return [];
    }
    return data || [];
  },
  enabled: !!periodoInicio && !!periodoFim
});
```

## Resultado Esperado

| Cenário | Comportamento |
|---------|--------------|
| "Todas as empresas" | Exibe Top 10 consolidado (soma de Exchange + Inpari + Ecom Club) |
| "Exchange E-commerce" | Exibe Top 10 apenas da Exchange |
| "Inpari Distribuição" | Exibe Top 10 apenas da Inpari |

## Arquivos Modificados

1. `supabase/migrations/[nova].sql` - Atualizar RPC para suportar `p_empresa_id = NULL`
2. `src/pages/Dashboard.tsx` - Remover restrição de empresa obrigatória, adicionar indicador visual de visão consolidada

