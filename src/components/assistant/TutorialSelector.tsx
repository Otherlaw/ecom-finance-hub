import { GraduationCap, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tutorial } from '@/lib/tutorial-data';

interface TutorialComStatus extends Tutorial {
  concluido: boolean;
  progresso: { step: number; total: number; percentual: number } | null;
}

interface TutorialSelectorProps {
  tutoriais: TutorialComStatus[];
  onSelectTutorial: (tutorialId: string) => void;
  onVoltar: () => void;
}

export function TutorialSelector({ tutoriais, onSelectTutorial, onVoltar }: TutorialSelectorProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-700/50">
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="w-5 h-5 text-indigo-400" />
          <h3 className="font-medium text-zinc-200">Tutoriais Disponíveis</h3>
        </div>
        <p className="text-xs text-zinc-400">
          Escolha um tutorial para aprender sobre as funcionalidades do sistema
        </p>
      </div>

      {/* Lista de Tutoriais */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-2">
          {tutoriais.map((tutorial) => (
            <button
              key={tutorial.id}
              onClick={() => onSelectTutorial(tutorial.id)}
              className="w-full text-left p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-700/50 hover:border-zinc-600/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                {/* Ícone */}
                <div className="text-2xl shrink-0">{tutorial.icone}</div>
                
                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-zinc-200 text-sm">
                      {tutorial.nome}
                    </span>
                    {tutorial.concluido && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                  </div>
                  
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
                    {tutorial.descricao}
                  </p>
                  
                  <div className="flex items-center gap-3">
                    {/* Duração */}
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      <span>{tutorial.duracaoEstimada}</span>
                    </div>
                    
                    {/* Progresso */}
                    {tutorial.progresso && !tutorial.concluido && tutorial.progresso.step > 0 && (
                      <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                        {tutorial.progresso.step}/{tutorial.progresso.total} steps
                      </Badge>
                    )}
                    
                    {tutorial.concluido && (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                        Concluído
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Seta */}
                <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-700/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={onVoltar}
          className="w-full text-zinc-400 hover:text-zinc-200"
        >
          Voltar ao chat
        </Button>
      </div>
    </div>
  );
}
