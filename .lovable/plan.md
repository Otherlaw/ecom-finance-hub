
## Corrigir Margem no Top 10 Produtos e Remover Coluna Ads

### Problema Atual
A margem no Top 10 calcula apenas: `Lucro = Faturamento - CMV - Ads`, ignorando os custos reais da venda (comissao, tarifas, frete vendedor, impostos). Alem disso, a coluna "Ads" deve ser removida.

### O Que Sera Feito

**1. Atualizar a RPC `get_top_produtos_vendidos`**
- Agregar os custos de venda por produto/SKU a partir da tabela `marketplace_transactions`
- Novos campos retornados: `total_comissao`, `total_tarifas`, `total_frete_vendedor`, `total_impostos`
- Os custos serao rateados proporcionalmente ao valor de cada item no pedido (quando um pedido tem multiplos itens)
- Remover o campo `total_ads` (ou manter zerado para compatibilidade)

**2. Atualizar o calculo de margem no Dashboard (Dashboard.tsx)**
- Nova formula: `Lucro = Faturamento - CMV - Comissao - Tarifas - Frete Vendedor - Impostos`
- Margem = Lucro / Faturamento * 100

**3. Atualizar a tabela visual**
- Remover a coluna "Ads"
- Adicionar coluna "Custos Venda" (soma de comissao + tarifas + frete + impostos)
- Manter colunas: #, Produto, Preco Medio, Qtd Vendida, Faturamento, Custos Venda, Lucro, Margem

### Detalhes Tecnicos

**Migration SQL** — Recriar `get_top_produtos_vendidos`:
- Fazer JOIN com `marketplace_transactions` para obter `tarifas`, `taxas`, `frete_vendedor` e rateio proporcional por item
- Calculo de impostos via `empresas_config_fiscal.aliquota_imposto_vendas` (mesmo padrao da RPC de vendas)
- Retornar novos campos: `total_comissao`, `total_tarifas`, `total_frete_vendedor`, `total_impostos`

**Frontend (Dashboard.tsx)**:
- Atualizar o `useMemo` de processamento para usar os novos campos
- Calcular `custoVenda = comissao + tarifas + freteVendedor + impostos`
- `lucro = totalFaturado - cmv - custoVenda`
- Remover coluna Ads da tabela, adicionar coluna "Custos Venda"

### Arquivos Alterados
- Nova migration SQL (recriacao da RPC)
- `src/pages/Dashboard.tsx` (calculo de margem + layout da tabela)

### Como Testar
1. Abrir Dashboard e verificar o Top 10
2. Confirmar que a margem agora reflete os custos reais (comissao, tarifas, frete, impostos, CMV)
3. Confirmar que a coluna Ads foi removida e substituida por "Custos Venda"
4. Comparar margem de um produto com os dados da aba Vendas — devem ser consistentes
