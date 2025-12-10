import { ChevronLeft, ChevronRight, X, Bot, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TutorialStep as TutorialStepType, Tutorial } from '@/lib/tutorial-data';

interface TutorialStepProps {
  tutorial: Tutorial;
  step: TutorialStepType;
  stepIndex: number;
  totalSteps: number;
  onAvancar: () => void;
  onVoltar: () => void;
  onSair: () => void;
  onNavegar?: (path: string) => void;
}

export function TutorialStepComponent({
  tutorial,
  step,
  stepIndex,
  totalSteps,
  onAvancar,
  onVoltar,
  onSair,
  onNavegar,
}: TutorialStepProps) {
  const progressPercent = ((stepIndex + 1) / totalSteps) * 100;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

  const handleAvancar = () => {
    // Se há navegação definida, navegar primeiro
    if (step.navegarPara && onNavegar) {
      onNavegar(step.navegarPara);
    }
    onAvancar();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header com progresso */}
      <div className="px-4 py-3 border-b border-zinc-700/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tutorial.icone}</span>
            <span className="text-sm font-medium text-zinc-300">{tutorial.nome}</span>
          </div>
          <button
            onClick={onSair}
            className="p-1 rounded-full hover:bg-zinc-700/50 transition-colors"
            title="Sair do tutorial"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <Progress value={progressPercent} className="h-1.5 flex-1" />
          <span className="text-xs text-zinc-500 shrink-0">
            {stepIndex + 1}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Conteúdo do Step */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="flex items-start gap-3">
          {/* Avatar do Fin */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center shrink-0 border border-indigo-500/30">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>

          {/* Mensagem */}
          <div className="flex-1">
            <h4 className="font-medium text-zinc-200 mb-2">{step.titulo}</h4>
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">
              {step.mensagem}
            </p>

            {/* Indicador de navegação */}
            {step.navegarPara && (
              <div className="mt-3 flex items-center gap-2 text-xs text-indigo-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>Ao avançar, você será levado para: {step.navegarPara}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Botões de Navegação */}
      <div className="px-4 py-3 border-t border-zinc-700/50">
        <div className="flex items-center justify-between gap-2">
          {/* Botão Voltar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onVoltar}
            disabled={isFirstStep}
            className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>

          {/* Botão Avançar/Concluir */}
          <Button
            size="sm"
            onClick={handleAvancar}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
          >
            {isLastStep ? (
              <>Concluir</>
            ) : (
              <>
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>

        {/* Link para sair */}
        <button
          onClick={onSair}
          className="w-full mt-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Sair do tutorial e voltar ao chat
        </button>
      </div>
    </div>
  );
}
