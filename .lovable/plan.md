
## Plano: Corrigir Cálculo de Margem de Contribuição nas Vendas

### Contexto do Problema

Após análise detalhada do pedido `2000011606433945` no banco de dados, identificamos os seguintes problemas:

1. **Frete Vendedor incorreto (R$ 9,90):** O valor veio da API de `/shipments/costs` do ML, que retorna o custo de coleta/envio estimado pela API — mas para pedidos FLEX, o modelo de custo é diferente: o ML paga um "bônus por envio" ao vendedor, e o vendedor arca com um custo próprio de logística configurável.

2. **Rebate e bônus por envio não capturados:** A imagem mostra "Estorno → Descontos e bônus: R$ 2,98" e "Bônus por envio: R$ 1,10" — esses valores não estão salvos na transação. O `outros_descontos` está zerado.

3. **Imposto não configurável:** Está fixo em 6% (lido de `empresas_config_fiscal`). Precisa ser configurável diretamente no cadastro da empresa, com campo `aliquota_imposto_vendas` editável.

4. **Custo FLEX/Flex Turbo não configurável:** A tabela `empresa_logistica_config` existe mas está vazia e não tem UI de configuração.

5. **RPC não inclui rebate na MC:** O campo `outros_descontos` na transação deveria acumular rebates, mas está zerado.

### O Que Vai Ser Feito

---

#### A. Banco de Dados — Migrações

**1. Adicionar campo `aliquota_imposto_vendas` editável**
A tabela `empresas_config_fiscal` já existe com o campo `aliquota_imposto_vendas`. O problema é que não há UI para configurar. Precisamos expor isso no cadastro da empresa.

**2. Adicionar campo `rebate` e `bonus_envio` na tabela `marketplace_transactions`**
Para armazenar os valores reais vindos do ML (rebates de campanha e bônus por envio FLEX):
```sql
ALTER TABLE marketplace_transactions 
  ADD COLUMN IF NOT EXISTS rebate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_envio numeric DEFAULT 0;
```

**3. Upsert de `empresa_logistica_config`**
Garantir que RLS existe para permitir leitura/escrita pelos membros da empresa.

---

#### B. Sincronização ML (`ml-sync-orders`) — Capturar Rebate e Bônus por Envio

Na API de conciliações (`/billing/integration/details`), os tipos de eventos incluem:
- `DISCOUNT`/`CAMPAIGN_DISCOUNT` → rebate de campanha (entra como crédito)
- `SHIPPING_SUBSIDY`/`SHIPPING_BONUS` → bônus por envio FLEX

Vamos mapear esses tipos no `fetchBillingDetailsFromConciliation` para os campos `rebate` e `bonus_envio`, e salvá-los no upsert da transação.

Para o `frete_vendedor` em pedidos FLEX: se o pedido é FLEX e a API retorna custo de shipment, mas o ML paga o bônus, o `frete_vendedor` da tabela representa o **custo real do vendedor com logística**. Vamos separar:
- `bonus_envio`: valor que o ML paga ao vendedor (entra como receita/crédito)
- `frete_vendedor`: custo do vendedor com a logística FLEX (vem da configuração `empresa_logistica_config`)

---

#### C. RPC `get_vendas_por_pedido` — Incluir Rebate e Bônus no Cálculo

Atualizar a RPC para:
1. Somar `rebate` e `bonus_envio` como crédito na margem
2. Para pedidos FLEX: o `frete_vendedor` real = custo configurado da empresa (não o da API)
3. Incluir `rebate` e `bonus_envio` nos campos retornados por pedido
4. Usar `aliquota_imposto_vendas` da `empresas_config_fiscal` como imposto configurável (já faz isso, mas precisa funcionar quando a empresa ainda não tem config — default 6%)

A margem correta para o pedido exemplo deveria ser:
```
Receita Bruta:    R$ 82,10
- Comissão ML:   -R$ 10,67 (13%)
+ Rebate campanha: R$ 2,98 (crédito)
+ Bônus envio:     R$ 1,10 (crédito FLEX do ML)
- Custo FLEX conf: R$ X (configurado pela empresa, ex: R$ 9,90 ou zero)
- Imposto:        -R$ Y (% configurado pela empresa)
- CMV:           -R$ 42,00
= Margem Contribuição
```

---

#### D. UI — Configuração Fiscal e Logística na Página Empresas

Criar um componente `ConfigFiscalLogisticaModal.tsx` com campos:
- **Alíquota de Imposto de Venda (%)** — salva em `empresas_config_fiscal.aliquota_imposto_vendas`
- **Custo Flex (R$)** — salva em `empresa_logistica_config.flex_custo`
- **Custo Flex Turbo (R$)** — salva em `empresa_logistica_config.flex_turbo_custo`

Esse modal será acessível pelo botão "Configurações" na página Empresas ou direto em Configurações.

---

#### E. UI — Exibição na Tabela de Vendas

Atualizar `PedidosTableRow.tsx` para, na área expandida do pedido, mostrar:
- **Bônus por Envio** (verde, crédito) quando `bonus_envio > 0`
- **Rebate** (verde, crédito) quando `rebate > 0`
- **Custo Flex** (vermelho, separado do frete) quando FLEX/Flex Turbo

---

### Arquivos que Serão Modificados

| Arquivo | Tipo de Mudança |
|---|---|
| `supabase/migrations/...sql` | Adicionar `rebate` e `bonus_envio` na tabela, RLS para `empresa_logistica_config`, inserir `empresas_config_fiscal` se não existe |
| `supabase/functions/ml-sync-orders/index.ts` | Mapear rebates e bônus por envio da API de conciliações |
| `supabase/migrations/...sql` (RPC) | Atualizar `get_vendas_por_pedido` e `get_vendas_por_pedido_resumo_v2` |
| `src/components/empresas/EmpresaFormModal.tsx` | Adicionar campos de alíquota de imposto |
| `src/components/empresas/` | Novo `ConfigFiscalLogisticaModal.tsx` |
| `src/pages/Empresas.tsx` | Botão para abrir config fiscal/logística |
| `src/components/vendas/PedidosTableRow.tsx` | Mostrar rebate e bônus na área expandida |
| `src/hooks/useVendasPorPedido.ts` | Incluir novos campos no mapeamento |
| `src/integrations/supabase/types.ts` | Auto-atualizado pelo sistema |

---

### Ordem de Execução

```text
1. Migration SQL → adiciona colunas rebate/bonus_envio + RLS empresa_logistica_config
2. Migration SQL → atualiza RPCs get_vendas_por_pedido e get_vendas_por_pedido_resumo_v2
3. Edge Function → ml-sync-orders captura rebate/bonus_envio da API conciliações
4. Deploy ml-sync-orders
5. UI → EmpresaFormModal com campos de config fiscal/logística
6. UI → PedidosTableRow mostra rebate e bônus por envio
7. Hook → useVendasPorPedido mapeia novos campos
```

---

### Cuidados Importantes

- **Sem duplicidade:** O `rebate` e `bonus_envio` devem ser salvos como campos separados na transação, não como ajuste na comissão, para manter rastreabilidade
- **Compatibilidade:** Pedidos sem `rebate`/`bonus_envio` continuam funcionando (default 0)
- **FLEX vs coleta:** A distinção de tipo de envio vem do campo `logistic_type` da API de shipments; o `coleta` atual do pedido de exemplo está errado e será corrigido via re-sync
- **Imposto:** Permanece usando a alíquota configurada em `empresas_config_fiscal`; apenas adicionamos UI para configurar
