
# Plano: Implementar Envio de Email de Boas-vindas no Cadastro

## Situação Atual
- A configuração `enable_confirmations = false` no `supabase/config.toml` significa que não há exigência de confirmação de email
- Não existe nenhum sistema de envio de emails configurado no projeto
- Quando o usuário se cadastra, ele pode fazer login imediatamente (sem verificar email)

## Solução Proposta

Vamos implementar um sistema de email de boas-vindas usando **Resend** (serviço recomendado pelo Lovable para emails de autenticação).

### O que o cliente receberá:
- Email de boas-vindas após criar a conta
- Design profissional com a logo do ECOM Finance
- Mensagem personalizada com o nome da empresa cadastrada

---

## Etapas de Implementação

### 1. Configurar API Key do Resend
Você precisará criar uma conta gratuita no [Resend](https://resend.com) e fornecer a API Key.

### 2. Criar Edge Function para Envio de Email
```
supabase/functions/send-welcome-email/index.ts
```
- Recebe os dados do novo usuário (email, nome da empresa)
- Envia email de boas-vindas personalizado
- Template HTML com branding do ECOM Finance

### 3. Atualizar o Fluxo de Cadastro
Após o `signUp` bem-sucedido em `Auth.tsx`:
- Chamar a edge function para enviar o email
- Manter a experiência atual (usuário pode logar imediatamente)

### 4. (Opcional) Ativar Confirmação de Email
Se você quiser que o usuário **confirme o email antes de fazer login**:
- Alterar `enable_confirmations = true` no config
- Criar edge function com hook de autenticação para emails customizados

---

## Detalhes Técnicos

### Template do Email de Boas-vindas
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
|                    [LOGO ECOM FINANCE]              |
|                                                     |
|     Bem-vindo ao ECOM Finance! 🎉                   |
|                                                     |
|     Olá, [Nome da Empresa]!                         |
|                                                     |
|     Sua conta foi criada com sucesso.               |
|     Agora você pode gerenciar suas finanças         |
|     de e-commerce em um só lugar.                   |
|                                                     |
|     [Acessar sua conta]                             |
|                                                     |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Arquivos a serem criados/modificados
| Arquivo | Ação |
|---------|------|
| `supabase/functions/send-welcome-email/index.ts` | Criar (edge function) |
| `src/pages/Auth.tsx` | Modificar (chamar edge function após signup) |

---

## Pré-requisitos

Para prosseguir, você precisa:

1. **Criar conta no Resend**: https://resend.com (gratuito até 3.000 emails/mês)
2. **Criar API Key**: https://resend.com/api-keys
3. **Validar domínio** (opcional, mas recomendado para emails não irem para spam): https://resend.com/domains
   - Sem domínio validado, os emails serão enviados de `onboarding@resend.dev`

---

## Pergunta para você

**Você quer que o email seja apenas de boas-vindas (informativo), ou quer exigir que o usuário confirme o email antes de conseguir fazer login?**

A primeira opção é mais simples e mantém a experiência atual. A segunda opção é mais segura, mas adiciona uma etapa extra para o usuário.
