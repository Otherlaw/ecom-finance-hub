
# Plano: Simplificação do Dashboard de Vendas e Melhoria de UX

## Resumo das Alterações

O usuário solicitou duas mudanças na tela de Vendas:

1. **Remover custos de ADS e tarifa dos cálculos** - A comissão já engloba comissão + taxa fixa juntas, então não é necessário mostrar separadamente
2. **Mostrar nome fantasia da empresa na coluna "Conta"** - Em vez de mostrar o identificador técnico (ex: "EXDECORLTDA"), exibir o nome amigável (ex: "Inpari Distribuição")

---

## Alterações Propostas

### 1. Simplificar Dashboard de Vendas (VendasDashboard.tsx)

**Antes:** 6 cards (Vendas, Custo & Imposto, Comissão ML, Tarifa Fixa, Frete Vendedor, Margem)

**Depois:** 4 cards principais:
- **Vendas Aprovadas** - mantém igual
- **Custo & Imposto** - CMV + Imposto (sem ads)
- **Comissão** - engloba comissão + tarifa (unificado)
- **Frete Vendedor** - mantém igual
- **Margem de Contribuição** - recalculada sem separar ads/tarifa

**Ajustes nos cálculos de margem:**
- Remover `custoAds` do cálculo de margem
- Não exibir separadamente "Tarifa Fixa"
- A comissão já inclui tudo junto (comissão + tarifa)

### 2. Simplificar Cards por Tipo de Envio

Remover linha de ADS e ajustar cálculo de margem para não subtrair ads separadamente.

### 3. Remover Colunas Tarifa e ADS da Tabela de Pedidos

**Arquivos:** `PedidosTable.tsx` e `PedidosTableRow.tsx`

- Remover coluna "Tarifa" do header e rows
- Remover coluna "ADS" do header e rows  
- Ajustar exportação CSV para não incluir esses campos

### 4. Mostrar Nome Fantasia da Empresa na Coluna "Conta"

**Problema atual:** A coluna "Conta" mostra `conta_nome` que é um identificador técnico do marketplace (ex: "EXDECORLTDA")

**Solução:** Como cada transação já tem `empresa_id`, podemos buscar o `nome_fantasia` da empresa correspondente via join.

**Opções de implementação:**
1. **Alterar RPC `get_vendas_por_pedido`** - Fazer join com tabela `empresas` e retornar `nome_fantasia` junto com os dados do pedido
2. **Lookup no frontend** - Manter dados como estão e fazer lookup via hook `useEmpresas`

**Recomendação:** Opção 1 (RPC) é mais eficiente e garante consistência. Adicionar campo `empresa_nome_fantasia` no retorno da RPC.

---

## Detalhamento Técnico

### Arquivo: `src/components/vendas/VendasDashboard.tsx`

```
Alterações:
- Mudar grid de 6 para 4 colunas principais
- Remover card "Tarifa Fixa"
- Remover exibição de ADS no card de tarifas
- Ajustar função calcularMargem para não subtrair custoAds
- Ajustar TipoEnvioCard para não mostrar/calcular ads
```

### Arquivo: `src/components/vendas/PedidosTable.tsx`

```
Alterações:
- Remover colunas "Tarifa" e "ADS" do TableHeader
- Atualizar array de headers na exportação CSV
- Remover campos tarifa e ads do mapeamento de rows na exportação
```

### Arquivo: `src/components/vendas/PedidosTableRow.tsx`

```
Alterações:
- Remover TableCell de tarifa_fixa_total
- Remover TableCell de ads_total
- Remover linhas correspondentes na área expandida (resumo)
- Alterar coluna "Conta" para usar empresa_nome_fantasia (quando disponível via RPC)
```

### Arquivo: `src/pages/Vendas.tsx`

```
Alterações:
- Remover totalTarifas e totalCustoAds do resumoAdaptado (ou zerar)
- Simplificar props passadas para VendasDashboard
```

### Migração SQL (RPC)

```sql
-- Atualizar get_vendas_por_pedido para retornar nome_fantasia
-- Adicionar LEFT JOIN com empresas
-- Incluir e.nome_fantasia AS empresa_nome_fantasia no SELECT
```

---

## Impacto Visual

| Antes | Depois |
|-------|--------|
| 6 cards no dashboard | 4 cards (mais limpo) |
| Tarifa e ADS separados | Tudo incluso na comissão |
| Conta: "EXDECORLTDA" | Conta: "Inpari Distribuição" |
| Tabela com 15 colunas | Tabela com 13 colunas |

---

## Sequência de Implementação

1. Criar migração SQL para ajustar RPC `get_vendas_por_pedido` (adicionar nome_fantasia)
2. Atualizar `useVendasPorPedido.ts` para mapear novo campo
3. Atualizar `VendasDashboard.tsx` (remover tarifa e ads)
4. Atualizar `PedidosTable.tsx` (remover colunas)
5. Atualizar `PedidosTableRow.tsx` (remover células, usar nome fantasia)
6. Atualizar `Vendas.tsx` (simplificar resumo)
