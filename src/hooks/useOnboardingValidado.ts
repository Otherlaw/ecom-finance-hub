import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────
export interface MissingItem {
  id: string;
  label: string;
  actionUrl: string;
}

export interface StepValidation {
  ok: boolean;
  missing: MissingItem[];
}

export interface OnboardingEmpresa {
  id: string;
  empresa_id: string;
  current_step: number;
  step1_completed: boolean;
  step2_completed: boolean;
  step3_completed: boolean;
  onboarding_completo: boolean;
  missing_items: MissingItem[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIAS_OBRIGATORIAS = [
  "Receitas",
  "Custos",
  "Despesas Operacionais",
  "Impostos Sobre o Resultado",
];

// ── Validation functions ───────────────────────────────

async function validateStep1(empresaId: string): Promise<StepValidation> {
  const missing: MissingItem[] = [];

  const { data: empresa } = await supabase
    .from("empresas")
    .select("razao_social, nome_fantasia, cnpj, regime_tributario, endereco, inscricao_estadual")
    .eq("id", empresaId)
    .single();

  if (!empresa) {
    return { ok: false, missing: [{ id: "empresa_inexistente", label: "Empresa não encontrada", actionUrl: "/empresas" }] };
  }

  if (!empresa.razao_social || empresa.razao_social.trim() === "") {
    missing.push({ id: "razao_social", label: "Razão Social não preenchida", actionUrl: "/empresas" });
  }

  if (!empresa.cnpj || empresa.cnpj === "00.000.000/0000-00" || empresa.cnpj.startsWith("TEMP-")) {
    missing.push({ id: "cnpj", label: "CNPJ não preenchido ou temporário", actionUrl: "/empresas" });
  }

  if (!empresa.regime_tributario) {
    missing.push({ id: "regime_tributario", label: "Regime tributário não definido", actionUrl: "/empresas" });
  }

  // Check integrations (at least 1 marketplace connected OR manual flag)
  const { count } = await supabase
    .from("marketplace_tokens" as any)
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  if (!count || count === 0) {
    missing.push({ id: "canal_vendas", label: "Nenhum canal de vendas conectado", actionUrl: "/integracoes" });
  }

  return { ok: missing.length === 0, missing };
}

async function validateStep2(_empresaId: string): Promise<StepValidation> {
  const missing: MissingItem[] = [];

  // Check categorias financeiras exist and have required types
  const { data: categorias } = await supabase
    .from("categorias_financeiras")
    .select("tipo")
    .eq("ativo", true);

  const tiposExistentes = new Set((categorias || []).map((c) => c.tipo));

  for (const tipo of CATEGORIAS_OBRIGATORIAS) {
    if (!tiposExistentes.has(tipo)) {
      missing.push({
        id: `categoria_${tipo}`,
        label: `Categoria "${tipo}" não encontrada no plano de contas`,
        actionUrl: "/plano-contas",
      });
    }
  }

  // Check at least 1 categorization rule exists
  const { count: regrasCount } = await supabase
    .from("regras_categorizacao" as any)
    .select("*", { count: "exact", head: true })
    .eq("ativo", true);

  if (!regrasCount || regrasCount === 0) {
    missing.push({
      id: "regra_mapeamento",
      label: "Nenhuma regra de categorização automática criada",
      actionUrl: "/regras-categorizacao",
    });
  }

  return { ok: missing.length === 0, missing };
}

async function validateStep3(empresaId: string): Promise<StepValidation> {
  const missing: MissingItem[] = [];

  // Check if any import was done (bank transactions, marketplace transactions, or nfe_documents)
  const { count: bankCount } = await supabase
    .from("bank_transactions")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  const { count: mktCount } = await supabase
    .from("marketplace_transactions")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  const hasImport = (bankCount ?? 0) > 0 || (mktCount ?? 0) > 0;

  if (!hasImport) {
    missing.push({
      id: "primeira_importacao",
      label: "Nenhuma importação realizada (extrato, marketplace ou NF-e)",
      actionUrl: "/conciliacao",
    });
  }

  return { ok: missing.length === 0, missing };
}

// ── Hook ───────────────────────────────────────────────

export function useOnboardingValidado() {
  const { empresaAtiva, isLoading: empresaLoading } = useEmpresaAtiva();
  const queryClient = useQueryClient();
  const empresaId = empresaAtiva?.id;

  // Fetch onboarding state
  const { data: onboarding, isLoading: loadingOnboarding } = useQuery({
    queryKey: ["onboarding-empresa", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;

      const { data, error } = await supabase
        .from("onboarding_empresa" as any)
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (error) throw error;

      // Auto-create if not exists
      if (!data) {
        const { data: created, error: createError } = await supabase
          .from("onboarding_empresa" as any)
          .insert({ empresa_id: empresaId })
          .select()
          .single();

        if (createError) throw createError;
        return created as unknown as OnboardingEmpresa;
      }

      return data as unknown as OnboardingEmpresa;
    },
    enabled: !!empresaId,
  });

  // Validate all steps
  const { data: validations, isLoading: loadingValidation } = useQuery({
    queryKey: ["onboarding-validations", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const [step1, step2, step3] = await Promise.all([
        validateStep1(empresaId),
        validateStep2(empresaId),
        validateStep3(empresaId),
      ]);
      return { step1, step2, step3 };
    },
    enabled: !!empresaId,
    staleTime: 30_000, // Re-validate every 30s
  });

  // Update step completion
  const updateStep = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!empresaId) throw new Error("Sem empresa");

      const { error } = await supabase
        .from("onboarding_empresa" as any)
        .update(updates)
        .eq("empresa_id", empresaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-empresa", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-validations", empresaId] });
    },
  });

  // Advance step (validates before advancing)
  const avancarPasso = async () => {
    if (!validations || !onboarding) return;

    const step = onboarding.current_step;
    const validation = step === 1 ? validations.step1 : step === 2 ? validations.step2 : validations.step3;

    if (!validation.ok) {
      toast.error("Corrija os itens pendentes antes de avançar.");
      return;
    }

    const stepKey = `step${step}_completed` as const;

    if (step < 3) {
      await updateStep.mutateAsync({
        [stepKey]: true,
        current_step: step + 1,
        missing_items: [],
      });
    } else {
      // Completing step 3 = finish onboarding
      await updateStep.mutateAsync({
        step3_completed: true,
        onboarding_completo: true,
        completed_at: new Date().toISOString(),
        missing_items: [],
      });
      toast.success("Onboarding concluído! Bem-vindo ao ECOM Finance!");
    }
  };

  // Force re-validation
  const revalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["onboarding-validations", empresaId] });
  };

  // Computed
  const isComplete = onboarding?.onboarding_completo ?? false;
  const currentStep = onboarding?.current_step ?? 1;
  const isLoading = empresaLoading || loadingOnboarding || loadingValidation;

  const currentValidation: StepValidation | null = validations
    ? currentStep === 1
      ? validations.step1
      : currentStep === 2
        ? validations.step2
        : validations.step3
    : null;

  const progressPercent = isComplete
    ? 100
    : Math.round(
        (([validations?.step1?.ok, validations?.step2?.ok, validations?.step3?.ok].filter(Boolean).length) / 3) * 100
      );

  return {
    onboarding,
    validations,
    currentStep,
    currentValidation,
    isComplete,
    isLoading,
    progressPercent,
    avancarPasso,
    revalidar,
    updateStep,
    isPending: updateStep.isPending,
  };
}
