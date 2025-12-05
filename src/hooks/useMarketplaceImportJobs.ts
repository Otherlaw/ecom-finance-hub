import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MarketplaceImportJob {
  id: string;
  empresa_id: string;
  canal: string;
  arquivo_nome: string;
  total_linhas: number;
  linhas_processadas: number;
  linhas_importadas: number;
  linhas_duplicadas: number;
  linhas_com_erro: number;
  status: 'processando' | 'concluido' | 'erro';
  mensagem_erro: string | null;
  criado_em: string;
  atualizado_em: string;
  finalizado_em: string | null;
}

interface UseMarketplaceImportJobsParams {
  empresaId?: string;
}

interface UseMarketplaceImportJobsReturn {
  emAndamento: MarketplaceImportJob[];
  historico: MarketplaceImportJob[];
  isLoading: boolean;
  refetch: () => void;
  criarJob: ReturnType<typeof useMutation<MarketplaceImportJob, Error, Omit<MarketplaceImportJob, 'id' | 'criado_em' | 'atualizado_em' | 'finalizado_em'>>>;
  atualizarJob: ReturnType<typeof useMutation<void, Error, { id: string; updates: Partial<MarketplaceImportJob> }>>;
}

export function useMarketplaceImportJobs(params?: UseMarketplaceImportJobsParams): UseMarketplaceImportJobsReturn {
  const queryClient = useQueryClient();

  // Query com polling agressivo para jobs em andamento
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["marketplace_import_jobs", params?.empresaId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_import_jobs")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(50);

      if (params?.empresaId) {
        query = query.eq("empresa_id", params.empresaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as MarketplaceImportJob[];
    },
    // Polling a cada 2s quando há jobs em processamento
    refetchInterval: (query) => {
      const jobs = query.state.data as MarketplaceImportJob[] | undefined;
      const temJobsEmAndamento = jobs?.some(j => j.status === 'processando');
      return temJobsEmAndamento ? 2000 : false;
    },
    refetchIntervalInBackground: true,
    staleTime: 1000,
  });

  // Realtime subscription para atualizações em tempo real
  useEffect(() => {
    const channel = supabase
      .channel('marketplace-import-jobs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'marketplace_import_jobs',
        },
        (payload) => {
          console.log('[Realtime] Job update:', payload.eventType, payload.new);
          
          // Atualizar cache do React Query com os novos dados
          queryClient.setQueryData(
            ["marketplace_import_jobs", params?.empresaId],
            (oldData: MarketplaceImportJob[] | undefined) => {
              if (!oldData) return oldData;

              if (payload.eventType === 'INSERT') {
                const newJob = payload.new as MarketplaceImportJob;
                // Só adiciona se pertence à empresa filtrada (ou se não há filtro)
                if (!params?.empresaId || newJob.empresa_id === params.empresaId) {
                  return [newJob, ...oldData];
                }
                return oldData;
              }

              if (payload.eventType === 'UPDATE') {
                const updatedJob = payload.new as MarketplaceImportJob;
                return oldData.map(job => 
                  job.id === updatedJob.id ? updatedJob : job
                );
              }

              if (payload.eventType === 'DELETE') {
                const deletedId = (payload.old as { id: string }).id;
                return oldData.filter(job => job.id !== deletedId);
              }

              return oldData;
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, params?.empresaId]);

  // Separar jobs por status
  const emAndamento = jobs.filter(j => j.status === 'processando');
  const historico = jobs.filter(j => j.status !== 'processando').slice(0, 15);

  // Criar novo job
  const criarJob = useMutation({
    mutationFn: async (jobData: Omit<MarketplaceImportJob, 'id' | 'criado_em' | 'atualizado_em' | 'finalizado_em'>) => {
      const { data, error } = await supabase
        .from("marketplace_import_jobs")
        .insert({
          empresa_id: jobData.empresa_id,
          canal: jobData.canal,
          arquivo_nome: jobData.arquivo_nome,
          total_linhas: jobData.total_linhas,
          linhas_processadas: jobData.linhas_processadas,
          linhas_importadas: jobData.linhas_importadas,
          linhas_duplicadas: jobData.linhas_duplicadas,
          linhas_com_erro: jobData.linhas_com_erro,
          status: jobData.status,
          mensagem_erro: jobData.mensagem_erro,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MarketplaceImportJob;
    },
  });

  // Atualizar job existente
  const atualizarJob = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MarketplaceImportJob> }) => {
      const { error } = await supabase
        .from("marketplace_import_jobs")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
  });

  return {
    emAndamento,
    historico,
    isLoading,
    refetch,
    criarJob,
    atualizarJob,
  };
}

// Funções auxiliares para uso direto (sem hook)
export async function criarJobImportacao(data: {
  empresa_id: string;
  canal: string;
  arquivo_nome: string;
  total_linhas: number;
}): Promise<string> {
  const { data: job, error } = await supabase
    .from("marketplace_import_jobs")
    .insert({
      empresa_id: data.empresa_id,
      canal: data.canal,
      arquivo_nome: data.arquivo_nome,
      total_linhas: data.total_linhas,
      linhas_processadas: 0,
      linhas_importadas: 0,
      linhas_duplicadas: 0,
      linhas_com_erro: 0,
      status: 'processando',
      mensagem_erro: null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return job.id;
}

export async function atualizarProgressoJob(jobId: string, updates: {
  linhas_processadas?: number;
  linhas_importadas?: number;
  linhas_duplicadas?: number;
  linhas_com_erro?: number;
}): Promise<void> {
  const { error } = await supabase
    .from("marketplace_import_jobs")
    .update({
      ...updates,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[Job] Erro ao atualizar progresso:", error);
  }
}

export async function finalizarJob(jobId: string, resultado: {
  status: 'concluido' | 'erro';
  linhas_importadas?: number;
  linhas_duplicadas?: number;
  linhas_com_erro?: number;
  mensagem_erro?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("marketplace_import_jobs")
    .update({
      status: resultado.status,
      linhas_importadas: resultado.linhas_importadas,
      linhas_duplicadas: resultado.linhas_duplicadas,
      linhas_com_erro: resultado.linhas_com_erro,
      mensagem_erro: resultado.mensagem_erro || null,
      finalizado_em: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[Job] Erro ao finalizar job:", error);
  }
}

export async function cancelarJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("marketplace_import_jobs")
    .update({
      status: 'erro',
      mensagem_erro: 'Importação cancelada pelo usuário',
      finalizado_em: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[Job] Erro ao cancelar job:", error);
    throw error;
  }
}

export async function excluirJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("marketplace_import_jobs")
    .delete()
    .eq("id", jobId);

  if (error) {
    console.error("[Job] Erro ao excluir job:", error);
    throw error;
  }
}
