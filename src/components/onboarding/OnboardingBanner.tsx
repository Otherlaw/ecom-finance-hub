import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingWizard } from "./OnboardingWizard";
import { Sparkles, X, ChevronRight } from "lucide-react";

export function OnboardingBanner() {
  const { deveExibirOnboarding, progresso, proximoPasso } = useOnboarding();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Não exibir se onboarding completo ou foi dispensado
  if (!deveExibirOnboarding || dismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="hidden sm:flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="font-medium text-sm">Configuração Inicial</span>
            </div>
            
            <div className="flex-1 max-w-xs">
              <Progress value={progresso} className="h-2" />
            </div>
            
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {progresso}% concluído
            </span>
          </div>

          <div className="flex items-center gap-2">
            {proximoPasso && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWizardOpen(true)}
                className="gap-1 text-primary hover:text-primary"
              >
                <span className="hidden sm:inline">Próximo:</span>
                <span className="font-medium">{proximoPasso.title}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            
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

      <OnboardingWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
