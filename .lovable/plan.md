
# Plano: Corrigir extração do CNPJ do certificado ICP-Brasil

## Problema Identificado

A função `extractCnpjFromCertificate` na Edge Function `validate-certificate` está extraindo o CNPJ do **emissor** (autoridade certificadora) ao invés do CNPJ do **titular** (empresa dona do certificado).

### Logs que comprovam o problema:
```
certCnpj: "39157027000128"     ← CNPJ extraído (emissor)
expected: "29860042000184"      ← CNPJ da empresa (titular)
match: false
```

O sistema está encontrando o primeiro CNPJ que aparece nos atributos do Subject, que pode ser da autoridade certificadora (Serasa, Certisign, etc.).

---

## Solução Técnica

### Estrutura do Certificado ICP-Brasil

Em certificados e-CNPJ/A1 ICP-Brasil, o CNPJ do titular pode estar em:

1. **OID 2.16.76.1.3.3** - Campo específico ICP-Brasil para CNPJ de PJ no SAN (otherName)
2. **Campo OU (Organizational Unit)** - Geralmente contém o CNPJ após o nome da empresa
3. **Campo CN (Common Name)** - Formato típico: `NOME DA EMPRESA:CNPJ`
4. **Último OU** - Quando há múltiplos OUs, o CNPJ do titular costuma estar no último

### Estratégia de Extração (Prioridade)

A nova lógica irá:
1. **Primeiro**: Buscar no OID específico ICP-Brasil (2.16.76.1.3.3) no SAN
2. **Segundo**: Buscar no Common Name (CN) - padrão "NOME:CNPJ"
3. **Terceiro**: Buscar no último campo OU (mais confiável que o primeiro)
4. **Fallback**: Varrer todos os campos do Subject, mas priorizando os do final

---

## Alterações Necessárias

### 1. Edge Function `validate-certificate`

Reescrever a função `extractCnpjFromCertificate` com a seguinte lógica:

```text
1. Tentar extrair do SAN (Subject Alternative Name):
   - Buscar otherName com OID 2.16.76.1.3.3 (CNPJ ICP-Brasil)
   - Parse do conteúdo ASN.1 para extrair os 14 dígitos

2. Tentar extrair do Common Name (CN):
   - Padrão típico: "NOME DA EMPRESA:12345678000199"
   - Separar por ":" e pegar a última parte com 14 dígitos

3. Tentar extrair do último campo OU:
   - Em certificados ICP-Brasil, o último OU geralmente contém o CNPJ do titular

4. Fallback: varrer todos os atributos do Subject do FIM para o INÍCIO
   - Priorizar atributos mais próximos do titular
```

### 2. Melhorar logs de debug

Adicionar logs detalhados para diagnosticar de onde o CNPJ está sendo extraído:
- Log de todos os atributos do Subject
- Log de todos os altNames do SAN
- Log de qual fonte foi usada para extrair o CNPJ

### 3. Melhorar mensagem de erro

Quando o CNPJ não corresponder, mostrar:
- O CNPJ encontrado e de qual campo foi extraído
- Sugerir que o usuário verifique se o certificado é da empresa correta

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/validate-certificate/index.ts` | Reescrever `extractCnpjFromCertificate()` com nova lógica de extração prioritária |

---

## Comportamento Esperado Após Correção

1. **Certificado válido**: Sistema extrai o CNPJ correto do titular e valida contra o CNPJ da empresa
2. **Senha errada**: Retorna erro claro "A senha do certificado está incorreta"
3. **CNPJ divergente real**: Retorna erro explicando que o certificado pertence a outra empresa

---

## Seção Técnica: Estrutura ASN.1 do SAN ICP-Brasil

```text
SubjectAltName:
  otherName:
    type-id: 2.16.76.1.3.3 (id-icpbr-pj-cnpj)
    value: PrintableString "12345678000199"
```

A extração do otherName requer parse manual do ASN.1 raw, pois `node-forge` não decodifica automaticamente otherNames customizados.
