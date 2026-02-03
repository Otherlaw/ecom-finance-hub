

# Plano: Configurar Reply-To com Gmail

## O que será feito

Atualizar a Edge Function para adicionar o campo `reply_to` com o email `ecomfinanceapp@gmail.com`, garantindo que respostas dos clientes cheguem na sua caixa de entrada.

## Alteração Técnica

### Arquivo: `supabase/functions/send-welcome-email/index.ts`

**Linha 34-36 - Modificar a chamada do Resend:**

```typescript
// ANTES
const emailResponse = await resend.emails.send({
  from: "ECOM Finance <onboarding@resend.dev>",
  to: [email],
  subject: "Bem-vindo ao ECOM Finance! 🎉",
  // ...
});

// DEPOIS
const emailResponse = await resend.emails.send({
  from: "ECOM Finance <onboarding@resend.dev>",
  reply_to: "ecomfinanceapp@gmail.com",
  to: [email],
  subject: "Bem-vindo ao ECOM Finance! 🎉",
  // ...
});
```

## Resultado

- **Remetente exibido**: `ECOM Finance <onboarding@resend.dev>`
- **Respostas direcionadas para**: `ecomfinanceapp@gmail.com`

## Alternativa futura

Se você adquirir um domínio próprio (ex: `ecomfinance.com.br`), podemos configurar o Resend para enviar emails diretamente de `contato@ecomfinance.com.br` ou similar. Isso requer:
1. Acesso ao DNS do domínio
2. Adicionar registros SPF/DKIM no Resend


troque a api de resend para re_iCHC7ESC_HsRyELGofGrfZzqksNXy8nh7
