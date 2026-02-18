
## Causa Raiz Confirmada: `empresa_id` ambíguo nas CTEs da RPC

O erro exato é:
```
column reference "empresa_id" is ambiguous — It could refer to either a PL/pgSQL variable or a table column.
```

### Por que acontece?

A função `get_vendas_por_pedido` retorna uma tabela com uma coluna chamada `empresa_id`. Dentro do bloco PL/pgSQL, o PostgreSQL interpreta qualquer referência nua a `empresa_id` como ambígua — podendo ser a coluna de retorno da função OU uma coluna da tabela no SELECT.

As CTEs afetadas são:

**CTE `logistica` (linha 86):**
```sql
SELECT empresa_id, flex_custo, flex_turbo_custo
FROM empresa_logistica_config
```

**CTE `fiscal` (linha 91):**
```sql
SELECT empresa_id, aliquota_imposto_vendas
FROM empresas_config_fiscal
```

Ambas precisam qualificar a tabela de origem para o PostgreSQL conseguir resolver sem ambiguidade.

### A Correção (cirúrgica)

Apenas qualificar explicitamente `empresa_id` com o alias da tabela em cada CTE:

```sql
-- logistica
SELECT elc.empresa_id, elc.flex_custo, elc.flex_turbo_custo
FROM empresa_logistica_config elc

-- fiscal
SELECT ecf.empresa_id, ecf.aliquota_imposto_vendas
FROM empresas_config_fiscal ecf
```

Isso é suficiente para resolver o erro. Não há nenhuma outra alteração de lógica — o resto da função (paginação, flex, bônus) continua igual.

### O Que Será Feito

1. Uma única migration SQL que recria a função `get_vendas_por_pedido` com as qualificações de tabela corrigidas nas CTEs `logistica` e `fiscal`.

### Arquivo Alterado

- Migration SQL nova (apenas recria a RPC com a correção de ambiguidade)

### Como Testar

1. Abrir Vendas — os pedidos devem aparecer imediatamente
2. Confirmar que a contagem "3343 pedidos" bate com o que é exibido na tabela
3. Verificar que pedido `#2000011605388925` aparece como Flex com frete R$0,00
