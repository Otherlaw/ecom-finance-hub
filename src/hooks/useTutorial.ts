import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TUTORIAIS, Tutorial, TutorialStep, getTutorialById } from '@/lib/tutorial-data';

interface TutorialProgress {
  id: string;
  user_id: string;
  tutorial_id: string;
  step_atual: number;
  concluido: boolean;
  data_inicio: string;
  data_conclusao: string | null;
}

export function useTutorial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [tutorialAtivo, setTutorialAtivo] = useState<Tutorial | null>(null);
  const [stepAtual, setStepAtual] = useState(0);
  const [isTutorialMode, setIsTutorialMode] = useState(false);

  // Buscar progresso de todos os tutoriais do usuário
  const { data: progressos, isLoading: isLoadingProgress } = useQuery({
    queryKey: ['tutorial-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('tutorial_progress')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as TutorialProgress[];
    },
    enabled: !!user?.id,
  });

  // Mutation para salvar progresso
  const salvarProgresso = useMutation({
    mutationFn: async ({ 
      tutorialId, 
      step, 
      concluido = false 
    }: { 
      tutorialId: string; 
      step: number; 
      concluido?: boolean;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('tutorial_progress')
        .upsert({
          user_id: user.id,
          tutorial_id: tutorialId,
          step_atual: step,
          concluido,
          data_conclusao: concluido ? new Date().toISOString() : null,
          atualizado_em: new Date().toISOString(),
        }, {
          onConflict: 'user_id,tutorial_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-progress'] });
    },
  });

  // Iniciar um tutorial
  const iniciarTutorial = useCallback((tutorialId: string) => {
    const tutorial = getTutorialById(tutorialId);
    if (!tutorial) return;

    // Verificar se há progresso salvo
    const progresso = progressos?.find(p => p.tutorial_id === tutorialId);
    const startStep = progresso && !progresso.concluido ? progresso.step_atual : 0;

    setTutorialAtivo(tutorial);
    setStepAtual(startStep);
    setIsTutorialMode(true);

    // Salvar início
    salvarProgresso.mutate({ tutorialId, step: startStep });
  }, [progressos, salvarProgresso]);

  // Avançar para próximo step
  const avancarStep = useCallback(() => {
    if (!tutorialAtivo) return;

    const novoStep = stepAtual + 1;
    
    if (novoStep >= tutorialAtivo.steps.length) {
      // Tutorial concluído
      salvarProgresso.mutate({ 
        tutorialId: tutorialAtivo.id, 
        step: novoStep, 
        concluido: true 
      });
      setIsTutorialMode(false);
      setTutorialAtivo(null);
      setStepAtual(0);
    } else {
      setStepAtual(novoStep);
      salvarProgresso.mutate({ tutorialId: tutorialAtivo.id, step: novoStep });
    }
  }, [tutorialAtivo, stepAtual, salvarProgresso]);

  // Voltar para step anterior
  const voltarStep = useCallback(() => {
    if (!tutorialAtivo || stepAtual <= 0) return;
    
    const novoStep = stepAtual - 1;
    setStepAtual(novoStep);
    salvarProgresso.mutate({ tutorialId: tutorialAtivo.id, step: novoStep });
  }, [tutorialAtivo, stepAtual, salvarProgresso]);

  // Sair do tutorial
  const sairTutorial = useCallback(() => {
    if (tutorialAtivo) {
      salvarProgresso.mutate({ tutorialId: tutorialAtivo.id, step: stepAtual });
    }
    setIsTutorialMode(false);
    setTutorialAtivo(null);
    setStepAtual(0);
  }, [tutorialAtivo, stepAtual, salvarProgresso]);

  // Verificar se tutorial já foi concluído
  const tutorialJaConcluido = useCallback((tutorialId: string): boolean => {
    return progressos?.some(p => p.tutorial_id === tutorialId && p.concluido) ?? false;
  }, [progressos]);

  // Obter progresso de um tutorial específico
  const getProgressoTutorial = useCallback((tutorialId: string): { step: number; total: number; percentual: number } | null => {
    const progresso = progressos?.find(p => p.tutorial_id === tutorialId);
    const tutorial = getTutorialById(tutorialId);
    
    if (!tutorial) return null;
    
    const step = progresso?.step_atual ?? 0;
    const total = tutorial.steps.length;
    const percentual = Math.round((step / total) * 100);
    
    return { step, total, percentual };
  }, [progressos]);

  // Obter step atual como objeto
  const getCurrentStep = useCallback((): TutorialStep | null => {
    if (!tutorialAtivo) return null;
    return tutorialAtivo.steps[stepAtual] ?? null;
  }, [tutorialAtivo, stepAtual]);

  // Listar tutoriais com status
  const tutoriaisComStatus = TUTORIAIS.map(tutorial => ({
    ...tutorial,
    concluido: tutorialJaConcluido(tutorial.id),
    progresso: getProgressoTutorial(tutorial.id),
  }));

  return {
    // Estados
    isTutorialMode,
    tutorialAtivo,
    stepAtual,
    currentStep: getCurrentStep(),
    isLoadingProgress,
    
    // Dados
    tutoriais: TUTORIAIS,
    tutoriaisComStatus,
    progressos,
    
    // Ações
    iniciarTutorial,
    avancarStep,
    voltarStep,
    sairTutorial,
    
    // Helpers
    tutorialJaConcluido,
    getProgressoTutorial,
  };
}
