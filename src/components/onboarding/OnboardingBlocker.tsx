import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboardingValidado } from "@/hooks/useOnboardingValidado";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { OnboardingModal } from "./OnboardingModal";

/**
 * Wrap critical pages with this component.
 * If onboarding is not complete, shows a blocker modal instead of the page content.
 */
export function OnboardingBlocker({ children }: { children: React.ReactNode }) {
  const { isComplete, isLoading, currentStep } = useOnboardingValidado();
  const [wizardOpen, setWizardOpen] = useState(false);

  // During loading or if complete, render normally — never block while still loading
  if (isLoading || isComplete) return <>{children}</>;

  return (
    <>
      {children}

      {/* Blocker overlay */}
      <Dialog open={!isComplete && !wizardOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Configuração Pendente</DialogTitle>
            </div>
            <DialogDescription>
              Conclua a etapa {currentStep}/3 do onboarding para acessar esta funcionalidade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setWizardOpen(true)} className="gap-2">
              Ir para o Passo {currentStep}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OnboardingModal open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
