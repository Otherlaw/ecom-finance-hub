
# Plano: Corrigir Exclusão de Empresa (Resolver FK constraint)

## Problema Identificado

O erro:
```
update or delete on table "empresas" violates foreign key constraint 
"profiles_empresa_padrao_id_fkey" on table "profiles"
```

Ocorre porque o usuário `savio_apache_10@hotmail.com` tem a empresa **"EMPRESA FICTICIA"** definida como `empresa_padrao_id` no profile. A FK impede a exclusão.

## Situação Atual

| Tabela | Qtd Registros | Impacto |
|--------|---------------|---------|
| `user_empresas` | 1 | Vínculo dono → empresa |
| `profiles.empresa_padrao_id` | 1 | **Bloqueia exclusão** |
| `onboarding_status` | 1 | Referência à empresa |
| `marketplace_transactions` | 0 | Sem dados de vendas |

## Solução

Criar uma **RPC segura** que:
1. Limpa `empresa_padrao_id` nos profiles que referenciam a empresa
2. Remove vínculos em `user_empresas`
3. Remove referências em `onboarding_status`
4. Exclui a empresa

E atualizar o hook `useEmpresas` para usar essa RPC.

---

## Implementação

### Parte 1: Criar RPC `delete_empresa_cascade`

Migração SQL:

```sql
CREATE OR REPLACE FUNCTION public.delete_empresa_cascade(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se usuário é dono/admin da empresa
  IF NOT EXISTS (
    SELECT 1 FROM user_empresas 
    WHERE empresa_id = p_empresa_id 
      AND user_id = auth.uid()
      AND role_na_empresa IN ('dono', 'admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta empresa';
  END IF;

  -- 1. Limpar empresa_padrao_id nos profiles
  UPDATE profiles 
  SET empresa_padrao_id = NULL 
  WHERE empresa_padrao_id = p_empresa_id;

  -- 2. Limpar empresa_id no onboarding_status
  UPDATE onboarding_status 
  SET empresa_id = NULL, empresa_criada = false 
  WHERE empresa_id = p_empresa_id;

  -- 3. Remover vínculos user_empresas
  DELETE FROM user_empresas WHERE empresa_id = p_empresa_id;

  -- 4. Finalmente, excluir a empresa
  DELETE FROM empresas WHERE id = p_empresa_id;
END;
$$;
```

### Parte 2: Atualizar `useEmpresas.ts`

```typescript
const deleteEmpresa = useMutation({
  mutationFn: async (id: string) => {
    // Usar RPC que faz cascade seguro
    const { error } = await supabase.rpc("delete_empresa_cascade", {
      p_empresa_id: id
    });

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["empresas"] });
    queryClient.invalidateQueries({ queryKey: ["user-empresas"] });
    toast.success("Empresa excluída com sucesso!");
  },
  onError: (error: any) => {
    toast.error("Erro ao excluir empresa: " + error.message);
  },
});
```

---

## Resultado Esperado

1. Você conseguirá excluir a **"EMPRESA FICTICIA"** 
2. O usuário `savio_apache_10@hotmail.com` terá seu `empresa_padrao_id` zerado
3. O vínculo em `user_empresas` será removido
4. O `onboarding_status` será limpo

## Arquivos que Serão Modificados

1. `supabase/migrations/*_create_delete_empresa_cascade.sql` - Criar a RPC
2. `src/hooks/useEmpresas.ts` - Usar a RPC no `deleteEmpresa`

---

## Sobre o Usuário Órfão

Após a exclusão:
- O usuário `savio_apache_10@hotmail.com` **continuará existindo** no Auth
- Mas ficará **sem empresa vinculada** (empresa_padrao_id = NULL)
- No próximo login, ele verá uma tela vazia ou poderá criar nova empresa

Se quiser remover completamente o usuário do Auth, isso precisa ser feito manualmente no Cloud Dashboard (Auth → Users) ou via API admin.
