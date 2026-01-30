
# Plano: Corrigir Isolamento de Dados Entre Usuários/Empresas

## Problema Crítico

O usuário `savio_apache_10@hotmail.com` está vendo dados de outras empresas (Exchange, Inpari, Ecom Club) porque:

1. **RPCs com SECURITY DEFINER** não validam acesso do usuário quando `empresa_id = NULL`
2. **Políticas RLS duplicadas** estão criando conflitos - múltiplas policies para o mesmo comando são combinadas com OR
3. **A página Usuários mostra TODOS os usuários** porque o hook `useUsuarios` não filtra por empresa do usuário

## Dados Atuais

| Usuário | Role Global | Empresas Vinculadas |
|---------|-------------|---------------------|
| eusaviosantoss@gmail.com | admin | Ecom Club, Exchange, Inpari |
| savio_apache_10@hotmail.com | operador | Empresa de Empresa Teste |
| financeiro.exkidsecommerce@outlook.com | financeiro | Ecom Club, Exchange, Inpari |
| exchangeecommerce@outlook.com | operador | Ecom Club, Exchange, Inpari |

O problema é que `savio_apache_10` só deveria ver "Empresa de Empresa Teste", mas está vendo dados das outras empresas.

---

## Solução

### Parte 1: Limpar Políticas RLS Duplicadas

Remover policies duplicadas que estão causando conflitos:

```sql
-- Remover duplicatas de empresas
DROP POLICY IF EXISTS "empresas_delete_owner" ON empresas;
DROP POLICY IF EXISTS "empresas_select_own" ON empresas;
DROP POLICY IF EXISTS "empresas_update_owner" ON empresas;
DROP POLICY IF EXISTS "empresas_insert_authenticated" ON empresas;

-- Remover duplicatas de profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;  -- duplicata de "Admins can read all profiles"

-- Remover duplicatas de user_empresas
DROP POLICY IF EXISTS "user_empresas_select_own" ON user_empresas;
DROP POLICY IF EXISTS "user_empresas_delete_owner" ON user_empresas;
DROP POLICY IF EXISTS "user_empresas_insert_via_trigger" ON user_empresas;
```

### Parte 2: Corrigir Policy de INSERT em empresas

A policy `empresas_insert` tem `with_check: true` (sempre permite), isso precisa ser corrigido:

```sql
-- Remover policy permissiva
DROP POLICY IF EXISTS "empresas_insert" ON empresas;

-- A policy "empresas_insert_authenticated" já valida created_by = auth.uid()
```

### Parte 3: Criar função `get_user_empresa_ids()`

Criar função auxiliar que retorna apenas IDs das empresas que o usuário tem acesso:

```sql
CREATE OR REPLACE FUNCTION public.get_user_empresa_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    ARRAY_AGG(ue.empresa_id),
    ARRAY[]::uuid[]
  )
  FROM user_empresas ue
  WHERE ue.user_id = auth.uid();
$$;
```

### Parte 4: Corrigir RPCs de Dashboard/Vendas

Atualizar as RPCs para validar acesso quando `p_empresa_id = NULL`:

```sql
-- Exemplo de lógica corrigida:
-- Em vez de:
AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)

-- Usar:
AND (
  CASE 
    WHEN p_empresa_id IS NOT NULL THEN 
      mt.empresa_id = p_empresa_id 
      AND (public.has_role(auth.uid(), 'admin') OR p_empresa_id = ANY(public.get_user_empresa_ids()))
    ELSE 
      mt.empresa_id = ANY(public.get_user_empresa_ids())
      OR public.has_role(auth.uid(), 'admin')
  END
)
```

RPCs a corrigir:
- `get_vendas_por_pedido`
- `get_vendas_por_pedido_resumo`
- `get_dashboard_kpis_period`
- `get_top_produtos_vendidos`

### Parte 5: Restringir página Usuários para admins globais

O hook `useUsuarios` busca **todos os profiles** do sistema. Isso só faz sentido para admins globais. A página já verifica `isAdmin`, mas o hook não:

```typescript
// src/hooks/useUsuarios.ts
// Adicionar verificação de admin antes de buscar
const { isAdmin } = useAuth();

const { data: usuarios, isLoading } = useQuery({
  queryKey: ["usuarios"],
  queryFn: async () => {
    if (!isAdmin) {
      // Não-admins não deveriam acessar esta página
      return [];
    }
    // ... resto da query
  },
  enabled: isAdmin, // Só executa se for admin
});
```

### Parte 6: Restringir página Empresas para mostrar apenas empresas do usuário

Para não-admins, a página Empresas deve mostrar apenas empresas vinculadas:

```typescript
// src/pages/Empresas.tsx
// O RLS já deveria filtrar, mas vamos garantir no frontend também
const { userEmpresas } = useUserEmpresas();
const { isAdmin } = useAuth();

const empresasFiltradas = isAdmin 
  ? empresas 
  : empresas?.filter(e => userEmpresas.some(ue => ue.empresa_id === e.id));
```

---

## Arquivos que Serão Modificados

| Arquivo/Migração | Ação |
|------------------|------|
| `supabase/migrations/*_fix_rls_duplicates.sql` | Limpar policies duplicadas |
| `supabase/migrations/*_fix_rpcs_user_filter.sql` | Corrigir RPCs para validar acesso |
| `src/hooks/useUsuarios.ts` | Restringir acesso a admins |
| `src/pages/Empresas.tsx` | Garantir filtro no frontend |

---

## Resultado Esperado

Após as correções:

| Usuário | Verá na Página Empresas | Verá na Página Usuários |
|---------|-------------------------|-------------------------|
| eusaviosantoss (admin) | Todas as 4 empresas | Todos os 4 usuários |
| savio_apache_10 (operador) | Apenas "Empresa de Empresa Teste" | ❌ Sem acesso (só admins) |
| financeiro.exkidsecommerce | Ecom Club, Exchange, Inpari | ❌ Sem acesso |

---

## Seção Técnica: Arquitetura de Segurança Multi-Tenant

O sistema deve seguir esta hierarquia de acesso:

```text
┌─────────────────────────────────────────────────────────┐
│                    Admin Global                          │
│    (user_roles.role = 'admin')                          │
│    → Acesso total a todas empresas e usuários           │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                 Dono da Empresa                          │
│    (user_empresas.role_na_empresa = 'dono')             │
│    → Acesso total à sua(s) empresa(s)                   │
│    → Pode gerenciar colaboradores da empresa            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│            Admin/Financeiro da Empresa                   │
│    (user_empresas.role_na_empresa IN ('admin','fin'))   │
│    → Acesso a dados financeiros da empresa              │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Operador                              │
│    (user_empresas.role_na_empresa = 'operador')         │
│    → Acesso limitado/visualização básica                │
└─────────────────────────────────────────────────────────┘
```

As policies RLS garantem que:
1. Usuários só veem empresas às quais estão vinculados via `user_empresas`
2. Admins globais podem ver tudo para fins de gerenciamento
3. RPCs respeitam o mesmo padrão via `get_user_empresa_ids()`

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebrar acesso de admin global | Manter verificação `has_role(auth.uid(), 'admin')` em todas as policies |
| Performance com subquery em RPCs | Função `get_user_empresa_ids()` é cached (STABLE) |
| Usuário perder acesso durante migração | Executar em uma única transação |
