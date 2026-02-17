
# Resolver "Unsupported PKCS12 PFX data" de vez -- Re-encriptar PFX com OpenSSL 3

## Problema raiz

O Node.js 20 usa OpenSSL 3, que rejeita certificados PFX encriptados com cifras legadas (RC2, 3DES antigas). Isso quebra tanto o `https.Agent` nativo quanto o `node-forge` ao tentar parsear o PFX. Ate agora removemos o node-forge do caminho HTTPS, mas o erro persiste porque o proprio OpenSSL 3 do Node.js rejeita o PFX no handshake TLS.

A solucao definitiva (conforme o artigo compartilhado) e **re-encriptar o PFX usando o CLI do OpenSSL**, que automaticamente usa cifras modernas (AES-256-CBC). Depois disso, tanto o `https.Agent` quanto o `node-forge` (para assinatura XML) aceitam o certificado sem erros.

## Fluxo da solucao

```text
PFX original (cifra legada)
    |
    v
openssl pkcs12 -in legado.pfx -nodes -legacy -out temp.pem
    |
    v
openssl pkcs12 -in temp.pem -export -out moderno.pfx
    |
    v
PFX re-encriptado (AES-256-CBC) --> funciona no Node.js 20 / OpenSSL 3
```

## Alteracoes

### 1. Dockerfile -- instalar openssl CLI

O `node:20-alpine` inclui libssl mas nao o binario `openssl`. Adicionar:

```
RUN apk add --no-cache openssl
```

### 2. SefazClient -- metodo `upgradePfxIfNeeded()`

Novo metodo privado no construtor que:

1. Salva o PFX em arquivo temporario
2. Executa `openssl pkcs12 -in tmp.pfx -nodes -legacy -out tmp.pem -passin pass:SENHA`
3. Executa `openssl pkcs12 -in tmp.pem -export -out upgraded.pfx -passout pass:SENHA`
4. Le o PFX atualizado de volta para `this.pfxBuffer`
5. Remove arquivos temporarios
6. Se qualquer etapa falhar, mantem o PFX original (fallback silencioso)

Chamado no construtor **antes** de qualquer uso do PFX.

### 3. Construtor do SefazClient -- chamar upgrade

```text
constructor(pfxBase64, passphrase, ambiente, uf) {
  this.pfxBuffer = Buffer.from(normalizeBase64(pfxBase64), 'base64');
  this.passphrase = passphrase;
  this.upgradePfxIfNeeded();   // <-- novo
  ...
}
```

### 4. Sem outras alteracoes

- `createHttpsAgent` e `soapRequestFallback` continuam usando PFX direto (ja corrigidos)
- `extractPemFromPfx` (node-forge) continua existindo para `signXml` -- mas agora vai funcionar porque o PFX foi re-encriptado com cifra moderna
- Nenhum outro arquivo muda

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `nfe-worker/Dockerfile` | Adicionar `apk add --no-cache openssl` |
| `nfe-worker/src/sefaz-client.ts` | Adicionar metodo `upgradePfxIfNeeded()` e chamar no construtor |

## Como testar

1. Fazer deploy do worker no Render
2. Vincular certificado A1 na UI
3. Disparar sync -- deve logar `[SEFAZ] PFX re-encriptado com sucesso` e conectar sem erro
4. Se o certificado ja for moderno, deve logar `[SEFAZ] PFX ja compativel, sem necessidade de upgrade` e funcionar normalmente

## Riscos e mitigacao

- **openssl nao disponivel**: o Dockerfile garante a instalacao. O metodo tem try/catch e usa o PFX original como fallback.
- **Arquivos temporarios**: usados em `/tmp` com nomes unicos e removidos no `finally`.
- **Senha com caracteres especiais**: passada via `stdin` ou arquivo temp em vez de argumento CLI para evitar problemas de shell escaping.
