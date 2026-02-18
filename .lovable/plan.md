

# Corrigir mapeamento de produtos na aba Vendas

## Problemas identificados

1. **Dois botoes "Mapear"**: Na coluna CMV da tabela de pedidos, existe um botao "Mapear" que apenas expande a linha. Ao expandir, cada item tambem tem seu proprio botao "Mapear SKU". O botao da coluna CMV e redundante e deve ser removido.

2. **Criacao rapida so cria produto "unico"**: O formulario `CriarProdutoRapidoForm` sempre cria com `tipo: "unico"`. Nao ha opcao para criar produto com variacao (`variation_parent` + `variation_child`) nem kit.

3. **Variacao/kit nao aparece corretamente nos seletores**: O modal `MapearItensPedidoModal` usa `apenasRaiz: true` (default), o que oculta `variation_child`. Isso impede de vincular a variacao correta. Ja o `MapearCmvModal` usa `apenasRaiz: false`, o que mostra tudo, mas sem distincao visual entre parent e child.

---

## Alteracoes planejadas

### 1. Remover botao duplicado "Mapear" da coluna CMV

**Arquivo**: `src/components/vendas/PedidosTableRow.tsx`

Na coluna CMV (linhas 329-351), quando `semCMV` e verdadeiro, existe um botao "Mapear" que so faz expandir a linha. Esse botao sera substituido por um simples indicador textual "Sem custo" (igual ao tooltip da coluna Margem), ja que o mapeamento real e feito nos itens expandidos.

### 2. Mostrar variações e kits nos seletores de produto

**Arquivo**: `src/components/vendas/MapearItensPedidoModal.tsx`

Mudar a chamada de `useProdutos` para `apenasRaiz: false`, permitindo que variações (children) aparecam no seletor. Adicionar indicacao visual do tipo do produto na lista:
- `variation_parent` -> exibir "(Pai - sem custo proprio)"
- `variation_child` -> exibir os atributos de variacao (cor, tamanho, etc.)
- `kit` -> exibir "(Kit)"

**Arquivo**: `src/components/vendas/MapearCmvModal.tsx`

Ja usa `apenasRaiz: false`. Adicionar a mesma distincao visual de tipo na lista de produtos.

### 3. Permitir criar produto com variacao ou kit no formulario rapido

**Arquivo**: `src/components/vendas/CriarProdutoRapidoForm.tsx`

Adicionar um seletor de tipo de produto com 3 opcoes:
- **Produto Unico** (padrao) - comportamento atual
- **Variacao** - cria como `variation_child`, com campo extra para selecionar o produto pai (parent_id) e campo de atributos (ex: "Cor: Azul, Tamanho: M")
- **Kit** - cria como `kit`, com campo para informar os componentes (SKU + quantidade)

O formulario tera os mesmos campos minimos (SKU, Nome, Custo) mais os campos adicionais conforme o tipo selecionado.

---

## Detalhes tecnicos

### PedidosTableRow.tsx - Coluna CMV (linhas 329-351)

Antes:
```text
semCMV -> botao "Mapear" (chama handleToggleExpand)
```

Depois:
```text
semCMV -> texto "Sem custo" com icone de alerta (sem acao de clique)
```

A acao de expandir ja existe ao clicar na linha inteira.

### MapearItensPedidoModal.tsx - useProdutos (linha 85-88)

Antes:
```text
useProdutos({ empresaId, status: "ativo" })  // apenasRaiz default true
```

Depois:
```text
useProdutos({ empresaId, status: "ativo", apenasRaiz: false })
```

Na lista de produtos (CommandItem), mostrar tipo e atributos:
```text
"Camiseta Azul M" 
SKU: CAM-AZL-M | Custo: R$ 15,00 | Variacao
```

### CriarProdutoRapidoForm.tsx - Seletor de tipo

Adicionar Select com opcoes:
- "Produto Unico" (tipo: "unico")
- "Variacao de produto existente" (tipo: "variation_child") 
  - Campo adicional: Selecionar produto pai (Select com produtos tipo variation_parent)
  - Campo adicional: Atributos (ex: "Cor: Azul")
- "Kit" (tipo: "kit")
  - Campo adicional: Componentes (lista de SKU + quantidade)

---

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/components/vendas/PedidosTableRow.tsx` | Remover botao "Mapear" duplicado da coluna CMV |
| `src/components/vendas/MapearItensPedidoModal.tsx` | Usar `apenasRaiz: false` e adicionar indicacao de tipo |
| `src/components/vendas/MapearCmvModal.tsx` | Adicionar indicacao visual de tipo no seletor |
| `src/components/vendas/CriarProdutoRapidoForm.tsx` | Adicionar seletor de tipo (unico/variacao/kit) com campos extras |

## Como testar

1. Abrir aba Vendas, expandir um pedido sem CMV
2. Verificar que a coluna CMV mostra "Sem custo" (sem botao clicavel)
3. Clicar em "Mapear SKU" de um item -> no seletor de produto, verificar que variacoes e kits aparecem com indicacao visual
4. No mesmo modal, clicar em "+ Criar Produto Rapido" -> verificar que e possivel escolher tipo Variacao ou Kit
5. Criar uma variacao: selecionar produto pai, preencher atributos, e confirmar que o mapeamento funciona

