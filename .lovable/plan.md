
# Plano: Isolamento Multi-Tenant Completo (Sem Admin Global, Sem Mock)

## Contexto do Negócio

Você quer comercializar o sistema onde:
- Cada cliente pagante = 1 conta de usuário
- Cada cliente pode cadastrar várias empresas
- Cada cliente pode convidar colaboradores às suas empresas
- Clientes distintos JAMAIS compartilham dados

---

## Problemas Identificados

| Problema | Local | Impacto |
|----------|-------|---------|
| **ICMS Devido = R$ 45.000 (mock)** | `src/pages/ICMS.tsx` linha 34 | Mostra valor fictício para todos |
| **Cartão mock criado automaticamente** | `src/hooks/useCartoes.ts` + `src/lib/mock-cartao.ts` | Cria "Cartão Corporativo Exchange (Mock)" para novos usuários |
| **Alertas do assistente são mock** | `src/hooks/useAssistantEngine.ts` + `src/lib/assistant-data.ts` | Mostra alertas de "Exchange", "Ecom Club" para todos |
| **CNPJ zerado no cadastro** | `handle_new_user()` usa placeholder `00.000.000/0000-00` | CNPJ não é salvo corretamente |
| **Página Usuários restrita** | `src/pages/Usuarios.tsx` | Mostra "Acesso Restrito" - correto! Mas precisa mostrar colaboradores da empresa do cliente |
| **Botões Configurações/Marketplace não funcionam** | `src/pages/Empresas.tsx` | `DropdownMenuItem` sem `onClick` |
| **Integrações com config só para admin** | RLS de `integracao_config` | Só admin global pode ler/escrever, bloqueando clientes |
| **RPCs ainda podem vazar dados** | `get_dashboard_kpis_period` etc. | Se usuário não tem empresas, recebe dados de admin |

---

## Solução em 6 Partes

### Parte 1: Remover Todos os Dados Mock

**Arquivos a modificar:**

1. **`src/pages/ICMS.tsx`**
   - Remover `const ICMS_DEVIDO_MOCK = 45000;`
   - Calcular ICMS devido real a partir de vendas ou mostrar "Não configurado"

2. **`src/hooks/useCartoes.ts`**
   - Remover lógica de criação de mock
   - Se não há cartões, retornar lista vazia

3. **`src/lib/mock-cartao.ts`**
   - Remover arquivo ou manter apenas utilitários sem criação automática

4. **`src/hooks/useAssistantEngine.ts`**
   - Substituir `generateMockAlerts()` por lista vazia
   - Alertas reais virão de análise futura do banco

5. **`src/lib/assistant-data.ts`**
   - Remover `mockEmpresas` e `generateMockAlerts`
   - Manter apenas tipos e configurações

---

### Parte 2: Corrigir CNPJ no Cadastro

O trigger `handle_new_user()` cria empresa com CNPJ placeholder. Precisamos:

1. **Manter placeholder** (já está assim)
2. **Forçar preenchimento no onboarding** - o passo "Completar Dados da Empresa" já existe, mas não valida CNPJ

**Modificação em `src/pages/Empresas.tsx`:**
- Na listagem, destacar empresas com CNPJ placeholder
- Mostrar badge "Completar dados" quando CNPJ = `00.000.000/0000-00`

---

### Parte 3: Transformar Página Usuários em "Colaboradores da Empresa"

Em vez de mostrar TODOS os usuários do sistema (comportamento de admin global), mostrar apenas:
- Colaboradores vinculados às empresas do usuário logado
- Permitir convidar novos colaboradores

**Modificações:**

1. **`src/hooks/useUsuarios.ts`**
   - Buscar apenas `user_empresas` das empresas que o usuário tem acesso
   - Fazer join com `profiles` para obter nome/email

2. **`src/pages/Usuarios.tsx`**
   - Remover lógica de "admin global"
   - Mostrar colaboradores por empresa
   - Permitir convidar para empresa específica

---

### Parte 4: Corrigir RLS de `integracao_config` e `integracao_tokens`

Atualmente só admin pode acessar. Clientes precisam gerenciar suas integrações.

**Migração SQL:**

```sql
-- Remover policies antigas de admin-only
DROP POLICY IF EXISTS "Only admins can read integracao_config" ON integracao_config;
DROP POLICY IF EXISTS "Only admins can insert integracao_config" ON integracao_config;
DROP POLICY IF EXISTS "Only admins can update integracao_config" ON integracao_config;
DROP POLICY IF EXISTS "Only admins can delete integracao_config" ON integracao_config;

-- Criar policies baseadas em empresa
CREATE POLICY "Users can read own integracao_config"
ON integracao_config FOR SELECT
TO authenticated
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own integracao_config"
ON integracao_config FOR INSERT
TO authenticated
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own integracao_config"
ON integracao_config FOR UPDATE
TO authenticated
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own integracao_config"
ON integracao_config FOR DELETE
TO authenticated
USING (user_has_empresa_access(empresa_id));

-- Mesma lógica para integracao_tokens
DROP POLICY IF EXISTS "Only admins can read integracao_tokens" ON integracao_tokens;
DROP POLICY IF EXISTS "Only admins can insert integracao_tokens" ON integracao_tokens;
DROP POLICY IF EXISTS "Only admins can update integracao_tokens" ON integracao_tokens;
DROP POLICY IF EXISTS "Only admins can delete integracao_tokens" ON integracao_tokens;

CREATE POLICY "Users can read own integracao_tokens"
ON integracao_tokens FOR SELECT
TO authenticated
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own integracao_tokens"
ON integracao_tokens FOR INSERT
TO authenticated
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own integracao_tokens"
ON integracao_tokens FOR UPDATE
TO authenticated
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own integracao_tokens"
ON integracao_tokens FOR DELETE
TO authenticated
USING (user_has_empresa_access(empresa_id));
```

---

### Parte 5: Implementar Botões de Configurações e Marketplace

**Modificação em `src/pages/Empresas.tsx`:**

```tsx
<DropdownMenuItem onClick={() => navigate(`/empresas/${empresa.id}/configuracoes`)}>
  <Settings className="h-4 w-4 mr-2" />
  Configurações
</DropdownMenuItem>
<DropdownMenuItem onClick={() => navigate(`/integracoes?empresa=${empresa.id}`)}>
  <Store className="h-4 w-4 mr-2" />
  Marketplaces
</DropdownMenuItem>
```

---

### Parte 6: Remover Conceito de Admin Global

**Modificações:**

1. **Trigger `handle_new_user()`** - Remover lógica que dá `admin` ao primeiro usuário
2. **RPCs** - Remover fallback `has_role(auth.uid(), 'admin')` 
3. **Frontend** - Remover `isAdmin` de `useAuth.ts` ou sempre retornar `false`

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/*_fix_tenant_isolation.sql` | RLS de integrações + remover admin do trigger |
| `src/pages/ICMS.tsx` | Remover mock ICMS devido |
| `src/hooks/useCartoes.ts` | Remover criação de mock |
| `src/lib/mock-cartao.ts` | Remover ou esvaziar |
| `src/hooks/useAssistantEngine.ts` | Remover mock alerts |
| `src/lib/assistant-data.ts` | Remover mockEmpresas e generateMockAlerts |
| `src/hooks/useUsuarios.ts` | Buscar colaboradores das empresas do usuário |
| `src/pages/Usuarios.tsx` | Mostrar colaboradores por empresa |
| `src/pages/Empresas.tsx` | Adicionar onClick aos botões + badge CNPJ incompleto |
| `src/hooks/useAuth.ts` | Remover/desabilitar isAdmin |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Novo usuário `cliente_a@email.com` | Vê dados mock de outras empresas | Vê apenas sua empresa vazia |
| Página ICMS | R$ 45.000 devido (fictício) | "Configure o ICMS devido" ou cálculo real |
| Página Cartões | Cartão mock "Exchange" | Lista vazia |
| Página Usuários | "Acesso Restrito" | Colaboradores das suas empresas |
| Assistente | Alertas de "Ecom Club" | Lista vazia (sem alertas) |
| Integrações | Não consegue salvar config | Consegue conectar Mercado Livre |
| Botão Configurações | Nada acontece | Navega para configurações da empresa |

---

## Seção Técnica: Arquitetura Multi-Tenant Final

```text
┌─────────────────────────────────────────────────────────┐
│                     Cliente A                            │
│    (usuario: cliente_a@email.com)                       │
│                                                         │
│    ┌──────────────┐  ┌──────────────┐                   │
│    │  Empresa 1   │  │  Empresa 2   │                   │
│    │  (CNPJ xxx)  │  │  (CNPJ yyy)  │                   │
│    └──────┬───────┘  └──────┬───────┘                   │
│           │                  │                           │
│    ┌──────┴───────────┬─────┴────┐                      │
│    │ Colaborador 1    │ Colaborador 2                   │
│    │ (vendas@emp1)    │ (fin@emp2)                      │
│    └──────────────────┴──────────┘                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     Cliente B                            │
│    (usuario: cliente_b@email.com)                       │
│    ✗ Não vê NADA do Cliente A                           │
│    ┌──────────────┐                                     │
│    │  Empresa 3   │                                     │
│    │  (CNPJ zzz)  │                                     │
│    └──────────────┘                                     │
└─────────────────────────────────────────────────────────┘

Regras:
• user_empresas define acesso (user_id → empresa_id → role)
• RLS usa user_has_empresa_access(empresa_id)
• RPCs usam get_user_empresa_ids() para filtrar
• Não existe "admin global" - cada cliente é dono apenas do seu espaço
```

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Clientes podem perder dados durante migração | Não deletamos dados, apenas ajustamos acesso |
| Funcionalidades que dependiam de admin param de funcionar | Identificar e adaptar cada uma |
| Edge functions podem continuar usando admin | Usar Service Role apenas para operações específicas, não para leitura geral |

---

## Ordem de Implementação

1. **Migração SQL** - Corrigir RLS de integrações e trigger
2. **Remover mocks** - ICMS, Cartões, Alertas
3. **Corrigir Empresas.tsx** - Botões e badge CNPJ
4. **Refatorar Usuarios.tsx** - Mostrar colaboradores
5. **Desabilitar isAdmin** - useAuth.ts

