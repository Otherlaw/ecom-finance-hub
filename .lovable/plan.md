
## Problema Identificado: Conflito de Overload na Função `get_vendas_por_pedido`

### Causa Raiz

O log do console revela o erro exato:

```
Could not choose the best candidate function between:
  public.get_vendas_por_pedido(p_data_inicio => date, ...)
  public.get_vendas_por_pedido(p_empresa_id => uuid, p_data_inicio => text, ...)
```

Existem **duas versões** da função `get_vendas_por_pedido` no banco ao mesmo tempo:

| # | OID | Assinatura | Origem |
|---|-----|-----------|--------|
| Antiga | 122093 | `p_data_inicio date, p_data_fim date, p_empresa_id uuid, ...` | Criada antes das correções |
| Nova | 122133 | `p_empresa_id uuid, p_data_inicio text, p_data_fim text, ...` | Criada pela migração `20260218060144` |

A migração anterior tentou remover a função antiga com `DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid,text,text,text,text,text,text,text,text,integer,integer)` — mas essa assinatura **não batia** com a versão antiga (que usa `date`), então ela sobreviveu.

O PostgREST/PostgreSQL não consegue escolher qual usar quando o frontend envia os parâmetros, e retorna erro. A contagem (`get_vendas_por_pedido_count`) funciona porque só existe uma versão dela. Os dados somem enquanto a contagem aparece correta — exatamente o que o usuário está vendo.

### O Que Será Feito

**1 migração SQL apenas** — cirúrgica e sem riscos:

```sql
-- Remove a versão ANTIGA com parâmetros DATE
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(
  date, date, uuid, text, text, text, integer, integer, text, text, text
);
```

Nada mais precisa ser alterado:
- A função nova (com parâmetros `text`, OID 122133) **já está correta** com toda a lógica de flex/bonus_envio
- O hook `useVendasPorPedido.ts` já usa `p_page` e `p_page_size` corretamente
- O `get_vendas_por_pedido_count` e `get_vendas_por_pedido_resumo_v2` não têm conflito

### Nenhum Arquivo de Frontend será Alterado

A única mudança é a remoção da função duplicada do banco.

### Como Testar

1. Abrir a aba **Vendas** e selecionar uma empresa
2. A tabela deve exibir os pedidos do período (antes aparecia vazia mesmo com "3339 pedidos • Página 1 de 67")
3. Testar filtros de Tipo de Envio (Flex, Full, Coleta) — todos devem mostrar resultados
4. Verificar que o cálculo de Frete Vendedor em pedidos Flex (ex: R$10,90 - R$11,00 bônus = R$0) está correto
5. Verificar que pedidos Full/Coleta mostram o frete real da API sem alteração
