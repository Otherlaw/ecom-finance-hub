import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  useOnboardingValidado,
  type MissingItem,
  type StepValidation,
} from "@/hooks/useOnboardingValidado";
import {
  Building2,
  FolderTree,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Upload,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEP_CONFIG = [
  {
    num: 1,
    title: "Empresa e Integrações",
    description: "Dados da empresa, CNPJ, regime tributário e canal de vendas.",
    icon: Building2,
  },
  {
    num: 2,
    title: "Plano de Contas",
    description: "Categorias financeiras obrigatórias e regras de categorização.",
    icon: FolderTree,
  },
  {
    num: 3,
    title: "Revisão e Primeira Importação",
    description: "Importação inicial de dados (extrato, marketplace ou NF-e).",
    icon: Upload,
  },
];

function StepIndicator({
  num,
  current,
  validation,
}: {
  num: number;
  current: number;
  validation: StepValidation | null;
}) {
  const isActive = num === current;
  const isPast = num < current;
  const isOk = validation?.ok ?? false;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
          isPast || isOk
            ? "bg-primary text-primary-foreground"
            : isActive
              ? "bg-primary/20 text-primary border-2 border-primary"
              : "bg-muted text-muted-foreground"
        )}
      >
        {isPast || isOk ? <CheckCircle2 className="h-4 w-4" /> : num}
      </div>
      {num < 3 && (
        <div
          className={cn(
            "hidden sm:block w-12 h-0.5",
            isPast || isOk ? "bg-primary" : "bg-muted"
          )}
        />
      )}
    </div>
  );
}

function MissingItemRow({ item }: { item: MissingItem }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-destructive/5 border border-destructive/20">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-sm truncate">{item.label}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 gap-1 text-primary hover:text-primary"
        onClick={() => navigate(item.actionUrl)}
      >
        Corrigir
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
  const {
    currentStep,
    currentValidation,
    validations,
    progressPercent,
    avancarPasso,
    revalidar,
    isPending,
    isComplete,
  } = useOnboardingValidado();

  if (isComplete) return null;

  const stepConfig = STEP_CONFIG[currentStep - 1];
  const StepIcon = stepConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>Configuração Inicial</DialogTitle>
          </div>
          <DialogDescription>
            Complete as 3 etapas para usar o ECOM Finance com todos os recursos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-1">
            {STEP_CONFIG.map((s) => (
              <StepIndicator
                key={s.num}
                num={s.num}
                current={currentStep}
                validation={
                  s.num === 1
                    ? validations?.step1 ?? null
                    : s.num === 2
                      ? validations?.step2 ?? null
                      : validations?.step3 ?? null
                }
              />
            ))}
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Etapa {currentStep}/3
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Current step content */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{stepConfig.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {stepConfig.description}
                </p>
              </div>
            </div>

            {/* Checklist */}
            {currentValidation ? (
              currentValidation.ok ? (
                <div className="flex items-center gap-2 py-3 px-4 rounded-lg bg-primary/5 border border-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    Todos os itens desta etapa estão completos!
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    {currentValidation.missing.length} item(ns) pendente(s)
                  </Badge>
                  {currentValidation.missing.map((item) => (
                    <MissingItemRow key={item.id} item={item} />
                  ))}
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Validando...</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continuar Depois
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={revalidar}>
              Revalidar
            </Button>
            <Button
              onClick={avancarPasso}
              disabled={!currentValidation?.ok || isPending}
              className="gap-2"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentStep === 3 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Concluir
                </>
              ) : (
                <>
                  Próxima Etapa
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
