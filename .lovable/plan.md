

## Corrigir Onboarding: Auto-completar quando dados ja estao preenchidos

### Problema
O bloqueio de onboarding aparece mesmo quando todos os dados ja estao preenchidos (empresa, CNPJ, integracao, certificado, importacoes). Isso acontece porque o campo `onboarding_completo` no banco de dados so e marcado como `true` quando o usuario clica manualmente em "Proximo" em cada uma das 3 etapas. Se o usuario ja configurou tudo por conta propria, o sistema continua bloqueando.

### Solucao
Duas mudancas complementares:

**1. Auto-completar no hook `useOnboardingValidado`**
Adicionar um `useEffect` que detecta quando todas as 3 validacoes estao OK (`step1.ok && step2.ok && step3.ok`) e o onboarding ainda nao esta marcado como completo. Nesse caso, atualizar automaticamente o registro no banco para `onboarding_completo = true`, `step1_completed = true`, `step2_completed = true`, `step3_completed = true`.

**2. Considerar validacoes no `isComplete`**
Alterar a propriedade `isComplete` retornada pelo hook para tambem ser `true` quando todas as validacoes passam, mesmo antes do update no banco ser processado. Isso elimina o flash do modal bloqueador.

### Detalhes Tecnicos

**Arquivo: `src/hooks/useOnboardingValidado.ts`**

- Adicionar `useEffect` apos as queries de validacao:
```typescript
useEffect(() => {
  if (!validations || !onboarding || onboarding.onboarding_completo) return;
  if (validations.step1.ok && validations.step2.ok && validations.step3.ok) {
    updateStep.mutate({
      step1_completed: true,
      step2_completed: true,
      step3_completed: true,
      onboarding_completo: true,
      completed_at: new Date().toISOString(),
    });
  }
}, [validations, onboarding]);
```

- Alterar o calculo de `isComplete`:
```typescript
const allValid = validations?.step1?.ok && validations?.step2?.ok && validations?.step3?.ok;
const isComplete = onboarding?.onboarding_completo || allValid || false;
```

### Arquivos Alterados
- `src/hooks/useOnboardingValidado.ts` (unica alteracao)

### Como Testar
1. Abrir a pagina de Vendas — o modal de "Configuracao Pendente" NAO deve mais aparecer se os dados ja estao preenchidos
2. O banner de onboarding no topo deve desaparecer ou mostrar 100%
3. Verificar que para um usuario novo (sem dados), o onboarding continua funcionando normalmente
