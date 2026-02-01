import { useState } from "react";
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
import { useOnboarding, OnboardingStep } from "@/hooks/useOnboarding";
import { 
  Building2, 
  FileText, 
  FolderTree, 
  Upload, 
  CheckCircle2, 
  Circle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  empresa: Building2,
  dados_empresa: Building2,
  plano_contas: FileText,
  centros_custo: FolderTree,
  primeira_importacao: Upload,
};

export function OnboardingWizard({ open, onOpenChange }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const { passos, progresso, proximoPasso, finalizarOnboarding } = useOnboarding();
  const [isFinishing, setIsFinishing] = useState(false);

  const handleNavigateToStep = (step: OnboardingStep) => {
    if (step.route) {
      onOpenChange(false);
      navigate(step.route);
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await finalizarOnboarding();
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("Erro ao finalizar onboarding:", error);
    } finally {
      setIsFinishing(false);
    }
  };

  const allCompleted = passos.every(p => p.completed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>Bem-vindo ao ECOM Finance!</DialogTitle>
          </div>
          <DialogDescription>
            Complete os passos abaixo para configurar sua conta e começar a usar o sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            {passos.map((step, index) => {
              const Icon = stepIcons[step.id] || Circle;
              const isNext = proximoPasso?.id === step.id;
              
              return (
                <button
                  key={step.id}
                  onClick={() => handleNavigateToStep(step)}
                  disabled={step.completed}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left",
                    step.completed 
                      ? "bg-primary/5 border-primary/20 cursor-default"
                      : isNext
                        ? "bg-accent hover:bg-accent/80 border-primary cursor-pointer"
                        : "bg-muted/30 hover:bg-muted/50 border-border cursor-pointer"
                  )}
                >
                  {/* Step Number/Icon */}
                  <div className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                    step.completed 
                      ? "bg-primary text-primary-foreground"
                      : isNext
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}>
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium",
                        step.completed && "text-primary"
                      )}>
                        {step.title}
                      </span>
                      {isNext && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Próximo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {step.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  {!step.completed && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Continuar Depois
          </Button>
          
          {allCompleted ? (
            <Button
              onClick={handleFinish}
              disabled={isFinishing}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isFinishing ? "Finalizando..." : "Concluir Configuração"}
            </Button>
          ) : (
            <Button
              onClick={() => proximoPasso && handleNavigateToStep(proximoPasso)}
              className="gap-2"
            >
              Ir para Próximo Passo
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
