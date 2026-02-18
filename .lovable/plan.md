
## Problema: "Coleta" com Frete Vendedor - Erro no Cálculo de Margem

### O que foi encontrado

Após investigação detalhada do banco, foi identificado que o Mercado Livre usa o valor `self_service` no campo `logistic_type` para **dois cenários distintos**:

| Cenário | logistic_type | Característica | Tratamento atual |
|---|---|---|---|
| Coleta simples (Correios/Agência) | self_service | `frete_vendedor = 0`, sem bônus | Coleta → usa frete_api diretamente |
| **Coleta Flex** (ponto de coleta parceiro) | **self_service** | frete_vendedor ≈ custo_flex, **bonus_envio > 0** | ❌ Também trata como coleta simples |

O pedido reportado (`#06433945`) tem:
- `logistic_type = self_service` → classificado como "Coleta"
- `frete_vendedor = R$9,90` (custo real pago pelo vendedor)
- `bonus_envio = R$1,10` (subsídio do ML)
- **R$9,90 + R$1,10 = R$10,90 = exatamente o `flex_custo` configurado na empresa**

Ou seja, este pedido **É** um serviço de Coleta Flex (o ML subsidia parte do frete), mas o sistema não está aproveitando o bônus no cálculo da margem — tratando o frete vendedor como R$9,90 em vez de descontar o bônus.

**Escala do problema:**
- 201 pedidos `self_service` com `frete_vendedor = R$9,90` (padrão coleta flex)
- 3 desses têm `bonus_envio > 0` (bônus já capturado da API)
- Os demais 198 têm `bonus_envio = 0` — precisam ser resincronizados para capturar o bônus

### Causa Raiz

A RPC `get_vendas_por_pedido` só aplica a lógica de bônus para `tipo_envio IN ('flex', 'flex_turbo')`:

```sql
CASE
  WHEN ta.tipo_envio IN ('flex', 'flex_turbo') THEN
    GREATEST(0, COALESCE(l.custo, 0) - ta.bonus_envio_agg)
  ELSE
    ta.frete_vendedor_api  -- ← self_service cai aqui, bônus ignorado
END AS frete_efetivo
```

### O Que Será Feito

**Abordagem cirúrgica** — sem alterar a classificação visual do `tipo_envio` (permanece "Coleta"), apenas corrigindo a lógica de cálculo do frete efetivo:

**1. Atualizar a RPC `get_vendas_por_pedido`**

A lógica do CASE será expandida para incluir pedidos com `bonus_envio > 0`, independente do `tipo_envio`:

```sql
CASE
  WHEN ta.tipo_envio IN ('flex', 'flex_turbo') THEN
    GREATEST(0, COALESCE(l.custo, 0) - ta.bonus_envio_agg)
  WHEN ta.bonus_envio_agg > 0 THEN
    -- self_service (Coleta Flex) ou qualquer outro tipo com subsídio
    GREATEST(0, ta.frete_vendedor_api - ta.bonus_envio_agg)
  ELSE
    ta.frete_vendedor_api
END AS frete_efetivo
```

Isso garante que:
- **Flex/Flex Turbo**: custo_config - bonus (lógica atual, inalterada)
- **Coleta com bônus (Coleta Flex)**: frete_api - bonus (novo)
- **Full/Coleta sem bônus**: frete_api diretamente (inalterado)

**2. Nenhuma alteração no `tipo_envio` armazenado**

A classificação visual continua como "Coleta" no banco — o ML define assim via API. O que muda é apenas o cálculo financeiro do frete efetivo.

**3. Nenhuma alteração em arquivos de frontend**

Apenas 1 migration SQL será criada.

### Impacto Esperado

Para o pedido `#06433945`:
- Receita bruta: R$82,10
- Comissão: -R$7,69
- Frete Vendedor (antes): -R$9,90 ❌
- Frete Vendedor (depois): -R$8,80 ✓ (R$9,90 - R$1,10 bônus)
- Impostos: -R$7,39
- CMV: -R$42,00
- **MC (antes)**: R$15,12 (18,4%) — valor já considerando bônus pela lógica anterior errada
- **MC (depois)**: R$16,22 (19,8%) — correto com bônus deduzido do frete

### Como Testar

1. Abrir Vendas e localizar o pedido `#2000011606433945` (tipo "Coleta")
2. Verificar que o Frete Vendedor exibe R$8,80 (não R$9,90)
3. Verificar que a Margem de Contribuição aumentou proporcionalmente
4. Confirmar que pedidos Full e Coleta sem bônus continuam inalterados
5. Confirmar que pedidos Flex continuam usando `custo_config - bonus` (não `frete_api - bonus`)
