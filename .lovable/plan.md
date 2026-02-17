

# Corrigir SSL (CA chain) e remover fallback inseguro

## Resumo

Duas alteracoes cirurgicas no nfe-worker:

1. **Dockerfile**: instalar `ca-certificates` e definir `NODE_EXTRA_CA_CERTS` apontando para o bundle ICP-Brasil, garantindo que o Node confie na cadeia de CAs da SEFAZ sem precisar de `rejectUnauthorized: false`.

2. **sefaz-client.ts**: remover o metodo `soapRequestFallback` e o fallback automatico para `rejectUnauthorized: false`. Erros SSL serao propagados diretamente (facilitando diagnostico). O `createHttpsAgent` passara a usar `rejectUnauthorized: true` sempre.

O erro 656 (Consumo Indevido) nao requer alteracao de codigo -- o fluxo V2 ja persiste `ult_nsu` corretamente e trata o 656 com cooldown. O erro ocorreu porque o estado foi resetado durante testes (NSU voltou a 0). A correcao e operacional: aguardar o cooldown expirar e nao resetar o estado manualmente.

---

## Alteracoes

### 1. nfe-worker/Dockerfile

Adicionar `ca-certificates` na instalacao de pacotes e definir variaveis de ambiente para SSL:

```text
FROM node:20-alpine

RUN apk add --no-cache openssl ca-certificates && update-ca-certificates

WORKDIR /app
... (restante igual)

# Copiar certs para dist manualmente
RUN cp -r certs dist/ 2>/dev/null || true

# Forcar Node a usar CAs do sistema + bundle ICP-Brasil
ENV NODE_OPTIONS="--use-openssl-ca"
ENV NODE_EXTRA_CA_CERTS="/app/certs/icp-brasil.pem"

# Limpar dependencias de desenvolvimento
RUN npm prune --production
...
```

### 2. nfe-worker/src/sefaz-client.ts

**createHttpsAgent** -- sempre `rejectUnauthorized: true`:

Linha 232: mudar de `rejectUnauthorized: !!icpBrasilCA` para `rejectUnauthorized: true`.
Com `NODE_EXTRA_CA_CERTS` e `--use-openssl-ca` no ambiente, o Node confia na cadeia ICP-Brasil mesmo sem o `ca` explicito.

**soapRequest** -- remover fallback SSL (linhas 297-306):

Em vez de capturar erros SSL e chamar `soapRequestFallback`, simplesmente propagar o erro. Isso torna o diagnostico mais claro e elimina o risco de operar sem validacao SSL.

Substituir o bloco `req.on('error')` por:
```text
req.on('error', (err) => {
  console.error('[SEFAZ] Erro na requisicao SOAP:', err.message);
  reject(err);
});
```

**Remover metodo `soapRequestFallback`** inteiro (linhas 317-351).

### 3. Expandir paths de busca do CA (bonus)

Adicionar mais caminhos na lista `CA_PATHS` para cobrir o layout do Docker:

```text
const CA_PATHS = [
  path.join(__dirname, 'certs', 'icp-brasil.pem'),           // dist/certs/
  path.join(__dirname, '..', 'certs', 'icp-brasil.pem'),     // existente
  path.join(process.cwd(), 'certs', 'icp-brasil.pem'),       // existente
  path.join(process.cwd(), 'dist', 'certs', 'icp-brasil.pem'),
  '/app/certs/icp-brasil.pem',                                // Docker fixo
  '/opt/render/project/src/nfe-worker/certs/icp-brasil.pem',  // existente
];
```

---

## Sobre o erro 656

Nenhuma alteracao de codigo necessaria. O fluxo V2 ja:
- Persiste `ult_nsu` imediatamente apos resposta da SEFAZ
- Trata 656 com cooldown ate 00:00 BRT
- Nao volta NSU para 0 automaticamente

O erro ocorreu porque o estado foi resetado via "Hard Reset (DEV)" durante testes, fazendo o worker consultar NSU 0 novamente. A SEFAZ interpretou como consumo indevido. Basta aguardar o cooldown expirar (1h) e o proximo sync usara o `ult_nsu` correto.

---

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `nfe-worker/Dockerfile` | Adicionar `ca-certificates`, `ENV NODE_OPTIONS`, `ENV NODE_EXTRA_CA_CERTS` |
| `nfe-worker/src/sefaz-client.ts` | Expandir CA_PATHS, forcar `rejectUnauthorized: true`, remover `soapRequestFallback` |

## Como testar

1. Rebuild e deploy no Render
2. Logs devem mostrar `[SEFAZ] CA bundle ICP-Brasil carregado de: /app/certs/icp-brasil.pem` (ou similar)
3. Nao deve mais aparecer "tentando sem validacao" nos logs
4. Aguardar cooldown do 656 expirar, entao disparar sync -- deve conectar com SSL validado e consultar com o `ult_nsu` correto

