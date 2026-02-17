
# Correcao: Vendas zerando para periodos maiores e divergencia com Dashboard

## Diagnostico (causa raiz confirmada)

Os logs do console revelam a causa real: **statement timeout** em todas as RPCs de vendas para periodos maiores que 7 dias.

```
[Vendas][Resumo] ERRO RPC: canceling statement due to statement timeout
[Vendas][Pedidos] ERRO RPC: canceling statement due to statement timeout
Erro ao buscar metricas por tipo de envio: canceling statement due to statement timeout
Erro ao buscar resumo de pedidos anterior: canceling statement due to statement timeout
Erro ao buscar SKUs pendentes: canceling statement due to statement timeout
```

Com ~54.000 transacoes e ~35.000 itens, as RPCs que calculam CMV (custo) fazem subconsultas pesadas por item e estouram o timeout do banco. "Hoje" e "7 dias" funcionam porque processam poucos registros; 15/30 dias processam 12-24 mil registros com joins pesados e nao terminam a tempo.

A divergencia Dashboard vs Vendas ocorre porque usam agrupamentos diferentes:
- Dashboard: `DISTINCT ON (pedido_id)` - ignora pack_id
- Vendas: `COALESCE(pack_id, pedido_id, referencia_externa)` - agrupa por pack

## Plano de correcao (4 acoes)

### 1. Criar RPC de resumo otimizada (SEM calculo de CMV pesado)

O resumo exibido nos cards (Faturamento, Comissao, Frete, etc.) nao precisa do CMV calculado por item. Vamos criar uma versao leve da RPC `get_vendas_por_pedido_resumo` que:

- Soma diretamente os campos financeiros da tabela `marketplace_transactions` (valor_bruto, taxas, tarifas, frete_vendedor, custo_ads)
- Agrupa por `COALESCE(pack_id, pedido_id, referencia_externa)` para contar pedidos unicos
- Calcula impostos estimados via aliquota da empresa
- Para CMV: faz apenas uma contagem aproximada (pedidos com/sem custo) em vez de calcular valor exato
- Elimina os JOINs pesados com `marketplace_transaction_items` e `produtos`

Impacto: o resumo que hoje leva >8 segundos (timeout) passa a rodar em <1 segundo.

### 2. Adicionar indice parcial otimizado

Criar indice cobrindo exatamente o filtro principal das RPCs de vendas:

```sql
CREATE INDEX CONCURRENTLY idx_mkt_tx_venda_credito_data 
ON marketplace_transactions (data_transacao DESC, empresa_id)
INCLUDE (pack_id, pedido_id, referencia_externa, valor_bruto, taxas, tarifas, frete_vendedor, custo_ads, valor_liquido, outros_descontos, status, tipo_envio, conta_nome, canal)
WHERE tipo_transacao = 'venda' AND tipo_lancamento = 'credito';
```

Isso permite que tanto o resumo quanto a contagem e a paginacao usem index-only scan.

### 3. Reduzir queries concorrentes desnecessarias

Na pagina de Vendas, 6+ RPCs disparam simultaneamente. Vamos:

- **Desativar `useVendasPendentes`** quando nenhuma empresa esta selecionada (consolidado) - este hook ja da timeout e nao e critico
- **Desativar `useVendasComparativo`** (periodo anterior) quando o periodo e longo (>15 dias) - reduz pela metade a carga
- **Desativar `useVendasPaginadas` para metricas por tipo de envio** quando no consolidado - esta query tambem da timeout e e secundaria

### 4. Alinhar Dashboard com Vendas (mesma logica de agrupamento)

Ajustar a RPC `get_dashboard_kpis_period` para usar `COALESCE(pack_id, pedido_id, referencia_externa)` em vez de `DISTINCT ON (pedido_id)`, garantindo que os numeros de pedidos e faturamento sejam identicos entre Dashboard e Vendas.

## Detalhes tecnicos

### Arquivos alterados

| Arquivo | Motivo |
|---------|--------|
| Migration SQL (nova) | Nova RPC `get_vendas_por_pedido_resumo_v2` otimizada + indice + ajuste no `get_dashboard_kpis_period` |
| `src/hooks/useVendasPorPedido.ts` | Chamar a RPC v2 otimizada no resumo |
| `src/hooks/useVendasComparativo.ts` | Desativar para periodos longos |
| `src/hooks/useVendasPendentes.ts` | Desativar no modo consolidado |
| `src/pages/Vendas.tsx` | Condicionar chamadas dos hooks secundarios |

### Nova RPC: `get_vendas_por_pedido_resumo_v2`

```sql
-- Versao otimizada: SEM join para CMV, apenas financeiro direto
WITH pedidos AS (
  SELECT 
    COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS gk,
    mt.empresa_id,
    SUM(COALESCE(mt.valor_bruto, 0)) AS bruto,
    SUM(COALESCE(mt.taxas, 0)) AS taxas,
    SUM(COALESCE(mt.tarifas, 0)) AS tarifas,
    SUM(COALESCE(mt.frete_vendedor, 0)) AS frete_v,
    SUM(COALESCE(mt.custo_ads, 0)) AS ads,
    SUM(COALESCE(mt.outros_descontos, 0)) AS descontos,
    SUM(COALESCE(mt.valor_liquido, 0)) AS liquido,
    COUNT(*) AS tx_count
  FROM marketplace_transactions mt
  WHERE mt.tipo_transacao = 'venda'
    AND mt.tipo_lancamento = 'credito'
    AND mt.data_transacao >= v_data_inicio
    AND mt.data_transacao <= v_data_fim
    AND (empresa filter)
  GROUP BY gk, mt.empresa_id
)
SELECT 
  COUNT(*) AS total_pedidos,
  SUM(tx_count) AS total_itens,
  SUM(bruto) AS valor_produto_total,
  -- ... demais somas diretas
FROM pedidos p
LEFT JOIN empresas_config_fiscal ecf ON ecf.empresa_id = p.empresa_id;
```

### Condicoes para hooks secundarios

```typescript
// useVendasComparativo: desativar para periodos > 15 dias
const diasPeriodo = differenceInDays(dateRange.to, dateRange.from);
const habilitarComparativo = diasPeriodo <= 15;

// useVendasPendentes: desativar no consolidado
const habilitarPendentes = !!empresaId;
```

## O que NAO sera alterado

- Tela de Dashboard (apenas alinhamento da RPC)
- Tela de Integracoes
- Logica de sincronizacao ML
- RLS policies
- Fluxo de Caixa, Conciliacoes ou qualquer outra aba

## Resultado esperado

- Vendas exibe dados corretos para TODOS os periodos (15, 30 dias, mes, ano)
- Dashboard e Vendas mostram os mesmos numeros de faturamento e pedidos
- Tempo de resposta < 2 segundos mesmo para periodos longos
- CMV detalhado continua disponivel ao expandir cada pedido individual
