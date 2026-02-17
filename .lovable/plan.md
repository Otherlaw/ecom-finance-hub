

# Extensao Chrome -- Margem de Contribuicao no Mercado Livre

## Visao geral

Criar uma extensao Chrome que injeta informacoes de margem de contribuicao diretamente nas paginas do Mercado Livre (listagem de vendas, detalhe de venda e anuncios/promocoes), usando os dados de custo e taxas ja cadastrados no ECOM Finance.

A extensao vai funcionar em 3 contextos (conforme os screenshots):
1. **Lista de vendas** (`mercadolivre.com.br/vendas/*`) -- badge de margem ao lado do preco
2. **Detalhe da venda** (`mercadolivre.com.br/vendas/*/detalhe*`) -- painel lateral com breakdown
3. **Anuncios/promocoes** (`mercadolivre.com.br/anuncios/*`) -- tooltip com margem simulada

---

## Arquitetura

```text
Pagina ML (content script)
    |
    | extrai SKU, anuncio_id, preco, qtd do DOM
    |
    v
Edge Function "ml-margin-lookup"
    |
    | recebe: empresa_id + lista de { sku, anuncio_id, preco_final, qtd }
    | consulta: produto_marketplace_map -> produtos.custo_medio
    |           marketplace_financial_events (comissao, tarifa)
    |           empresas_config_fiscal (aliquota imposto)
    |           sku_costs (fallback de custo)
    | retorna: para cada item { custo, comissao, tarifa, frete, imposto, margem, margem_pct }
    |
    v
Content script injeta badge/tooltip na pagina
```

---

## Componentes a criar

### 1. Edge Function: `supabase/functions/ml-margin-lookup/index.ts`

**Endpoint POST** que recebe:
```json
{
  "empresa_id": "uuid",
  "items": [
    { "sku": "XX-YY-ZZ", "anuncio_id": "MLB123", "preco_final": 19.83, "quantidade": 1 }
  ]
}
```

**Retorna** para cada item:
```json
{
  "sku": "XX-YY-ZZ",
  "anuncio_id": "MLB123",
  "preco_final": 19.83,
  "custo_unitario": 11.00,
  "comissao": 5.00,
  "tarifa_fixa": 3.63,
  "frete_vendedor": 0,
  "imposto": 1.59,
  "margem": -1.39,
  "margem_pct": -7.01,
  "fonte_custo": "produto" | "sku_costs" | "nao_encontrado"
}
```

**Logica interna:**
- Autenticacao via Bearer token (session do usuario ECOM Finance)
- Valida que o usuario tem acesso a empresa_id via `get_user_empresa_ids()`
- Para cada item: busca custo via `produto_marketplace_map` -> `produtos.custo_medio`, fallback `sku_costs`
- Busca aliquota de imposto da `empresas_config_fiscal`
- Calcula comissao/tarifa usando as regras do ML (baseado no preco, similar ao modulo Precificacao)

### 2. Pasta `chrome-extension/` no repositorio

Arquivos da extensao:

| Arquivo | Funcao |
|---|---|
| `manifest.json` | Manifest V3 com permissoes para `mercadolivre.com.br` |
| `popup.html` + `popup.js` | Tela de configuracao (URL do ECOM Finance, login, empresa) |
| `content.js` | Script injetado nas paginas do ML que extrai dados e injeta badges |
| `background.js` | Service worker para gerenciar token/sessao |
| `styles.css` | Estilos dos badges e tooltips injetados |
| `icons/` | Icones da extensao (16, 48, 128px) |

### 3. Content Script -- Comportamento por pagina

**Lista de vendas** (`/vendas/omni/lista*`):
- Detecta cada card de venda na listagem
- Extrai: SKU (texto "SKU: XXX"), preco (texto "R$ XX,XX"), anuncio_id (link do produto)
- Envia batch para a edge function
- Injeta badge verde/vermelho com "R$ X,XX (XX%)" ao lado do preco
- Ao passar o mouse: tooltip com breakdown (Preco Final, Frete, Tarifa, Custo, Imposto, Margem)

**Detalhe da venda** (`/vendas/*/detalhe*`):
- Extrai preco, tarifas (ja visiveis na pagina), SKU
- Injeta painel "Margem de Contribuicao" com custo do produto e imposto (dados do ECOM Finance)

**Anuncios/promocoes** (`/anuncios/lista/promos*`):
- Extrai SKU e preco final da tabela de anuncios
- Injeta coluna/badge com margem calculada
- No modal de promocao: injeta tooltip com breakdown

### 4. Config.toml -- registrar nova funcao

Adicionar:
```toml
[functions.ml-margin-lookup]
verify_jwt = false
```
(A validacao de JWT sera feita manualmente no codigo para flexibilidade)

---

## Detalhes tecnicos

### Autenticacao da extensao

1. Usuario abre popup da extensao
2. Faz login com email/senha do ECOM Finance (via Supabase Auth)
3. Token JWT armazenado no `chrome.storage.local`
4. Content script envia requisicoes com `Authorization: Bearer <token>`
5. Background script faz refresh do token quando necessario

### Calculo da margem (na edge function)

```text
Margem = Preco Final - Custo - Comissao - Tarifa - Frete Vendedor - Imposto
Margem % = (Margem / Preco Final) * 100
```

Comissao e tarifa: usar valores da `marketplace_financial_events` se existirem para o anuncio, senao estimar usando regras padrao do ML (ex: 12% comissao, tarifa fixa baseada no preco).

### Observacao sobre MutationObserver

O ML usa SPA (single-page app), entao o content script precisa de um `MutationObserver` para detectar quando a pagina muda e re-injetar os badges.

---

## Arquivos alterados/criados

| Arquivo | Tipo |
|---|---|
| `chrome-extension/manifest.json` | Novo |
| `chrome-extension/popup.html` | Novo |
| `chrome-extension/popup.js` | Novo |
| `chrome-extension/content.js` | Novo |
| `chrome-extension/background.js` | Novo |
| `chrome-extension/styles.css` | Novo |
| `supabase/functions/ml-margin-lookup/index.ts` | Novo |
| `supabase/config.toml` | Atualizado (nova funcao) |

## Como testar

1. Apos implementacao, carregar a extensao no Chrome via `chrome://extensions` (modo desenvolvedor) apontando para a pasta `chrome-extension/`
2. Fazer login com credenciais do ECOM Finance no popup
3. Navegar para a listagem de vendas do ML -- badges de margem devem aparecer
4. Clicar em uma venda para ver o breakdown no detalhe

