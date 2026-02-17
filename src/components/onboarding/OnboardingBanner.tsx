import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useOnboardingValidado } from "@/hooks/useOnboardingValidado";
import { OnboardingModal } from "./OnboardingModal";
import { Sparkles, X, ChevronRight } from "lucide-react";

export function OnboardingBanner() {
  const { isComplete, isLoading, currentStep, progressPercent } = useOnboardingValidado();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || isComplete || dismissed) return null;

  const stepLabels: Record<number, string> = {
    1: "Empresa e Integrações",
    2: "Certificado Digital (A1)",
    3: "Revisão Final",
  };

  return (
    <>
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="hidden sm:flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="font-medium text-sm">Etapa {currentStep}/3</span>
            </div>

            <div className="flex-1 max-w-xs">
              <Progress value={progressPercent} className="h-2" />
            </div>

            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {progressPercent}% concluído
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWizardOpen(true)}
              className="gap-1 text-primary hover:text-primary"
            >
              <span className="hidden sm:inline">Próximo:</span>
              <span className="font-medium">{stepLabels[currentStep]}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dispensar</span>
            </Button>
          </div>
        </div>
      </div>

      <OnboardingModal open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
