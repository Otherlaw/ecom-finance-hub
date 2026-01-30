

# Plano: Corrigir Exclusão de Empresa + Adicionar Exclusão de Usuário

## Problema Atual

| Situação | Causa |
|----------|-------|
| Erro "Sem permissão para excluir empresa" | A RPC `delete_empresa_cascade` verifica apenas se você é dono/admin **daquela empresa específica** via `user_empresas`. Você quer excluir a "EMPRESA FICTICIA" de `savio_apache_10@hotmail.com`, mas você não está vinculado a ela. |
| Seu role global (admin) não está sendo respeitado | A RPC não consulta `user_roles` para verificar se você é admin global. |
| Não existe opção de excluir usuário | O sistema não tem essa funcionalidade implementada. |

---

## Solução

### Parte 1: Corrigir RPC `delete_empresa_cascade`

Atualizar a função para aceitar exclusão por **admins globais** (verificando `has_role(auth.uid(), 'admin')`), além dos donos da empresa.

**Migração SQL:**
```sql
CREATE OR REPLACE FUNCTION public.delete_empresa_cascade(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se usuário é dono/admin da empresa OU admin global
  IF NOT EXISTS (
    SELECT 1 FROM user_empresas 
    WHERE empresa_id = p_empresa_id 
      AND user_id = auth.uid()
      AND role_na_empresa IN ('dono', 'admin')
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta empresa';
  END IF;

  -- [resto da função permanece igual]
  UPDATE profiles SET empresa_padrao_id = NULL WHERE empresa_padrao_id = p_empresa_id;
  UPDATE onboarding_status SET empresa_id = NULL, empresa_criada = false WHERE empresa_id = p_empresa_id;
  DELETE FROM user_empresas WHERE empresa_id = p_empresa_id;
  DELETE FROM empresas WHERE id = p_empresa_id;
END;
$$;
```

---

### Parte 2: Criar RPC `delete_user_cascade` (Exclusão de Usuário + Empresa)

Criar função que:
1. Verifica se o chamador é admin global
2. Exclui vínculos do usuário (`user_empresas`, `user_roles`, `onboarding_status`)
3. Exclui empresas onde o usuário era o **único dono** (se não houver outros membros)
4. Remove o profile
5. Deleta o usuário do Auth via Admin API (edge function)

**Migração SQL (parte que pode ser feita no banco):**
```sql
CREATE OR REPLACE FUNCTION public.delete_user_cascade(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresas_deletadas uuid[];
  v_empresa_id uuid;
BEGIN
  -- Apenas admins globais podem excluir usuários
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- 1. Buscar empresas onde este usuário é o ÚNICO membro
  SELECT ARRAY_AGG(empresa_id) INTO v_empresas_deletadas
  FROM (
    SELECT ue.empresa_id
    FROM user_empresas ue
    WHERE ue.user_id = p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM user_empresas ue2 
        WHERE ue2.empresa_id = ue.empresa_id 
          AND ue2.user_id != p_user_id
      )
  ) sub;

  -- 2. Limpar vínculos do usuário
  DELETE FROM user_empresas WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM onboarding_status WHERE user_id = p_user_id;

  -- 3. Limpar profiles que referenciam empresas a serem deletadas
  IF v_empresas_deletadas IS NOT NULL THEN
    UPDATE profiles 
    SET empresa_padrao_id = NULL 
    WHERE empresa_padrao_id = ANY(v_empresas_deletadas);
    
    UPDATE onboarding_status 
    SET empresa_id = NULL, empresa_criada = false 
    WHERE empresa_id = ANY(v_empresas_deletadas);
    
    -- Deletar empresas órfãs
    DELETE FROM empresas WHERE id = ANY(v_empresas_deletadas);
  END IF;

  -- 4. Deletar profile do usuário
  DELETE FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'empresas_deletadas', COALESCE(v_empresas_deletadas, ARRAY[]::uuid[])
  );
END;
$$;
```

**Edge Function `delete-auth-user`** (para deletar do Supabase Auth):
A RPC acima limpa dados do banco, mas não remove o usuário do Auth. Para isso, criaremos uma edge function que:
1. Chama a RPC `delete_user_cascade`
2. Usa `supabase.auth.admin.deleteUser()` para remover do Auth

---

### Parte 3: Adicionar UI para Exclusão de Usuário

Atualizar `src/pages/Usuarios.tsx` para incluir opção "Excluir Usuário" no menu de ações (apenas para admins).

**Mudanças no DropdownMenu:**
```tsx
<DropdownMenuItem 
  onClick={() => handleDeleteUser(user)}
  className="text-destructive"
>
  <Trash2 className="h-4 w-4 mr-2" />
  Excluir Usuário
</DropdownMenuItem>
```

**Modal de confirmação** com alerta explicando que:
- O usuário será removido permanentemente
- Empresas exclusivas dele serão excluídas
- Dados vinculados serão perdidos

---

## Arquivos que Serão Modificados/Criados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/*_fix_delete_empresa_admin.sql` | Corrigir RPC para respeitar admin global |
| `supabase/migrations/*_add_delete_user_cascade.sql` | Criar RPC de exclusão de usuário |
| `supabase/functions/delete-auth-user/index.ts` | Edge function para deletar do Auth |
| `src/hooks/useUsuarios.ts` | Adicionar mutation `deleteUser` |
| `src/pages/Usuarios.tsx` | Adicionar botão + modal de exclusão |

---

## Resultado Esperado

1. Você conseguirá excluir a "EMPRESA FICTICIA" (como admin global)
2. Você terá opção de excluir o usuário `savio_apache_10@hotmail.com`
3. Ao excluir o usuário, a empresa dele será automaticamente removida (já que ele é o único membro)

---

## Riscos

- **Exclusão irreversível**: Usuário e dados associados serão permanentemente perdidos
- **Cascata**: Se outros usuários estiverem vinculados à mesma empresa, ela NÃO será excluída automaticamente

