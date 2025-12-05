import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProdutoImportJob {
  id: string;
  empresa_id: string;
  arquivo_nome: string;
  total_linhas: number;
  linhas_processadas: number;
  linhas_importadas: number;
  linhas_atualizadas: number;
  linhas_com_erro: number;
  mapeamentos_criados: number;
  status: 'processando' | 'concluido' | 'erro';
  mensagem_erro: string | null;
  criado_em: string;
  atualizado_em: string;
  finalizado_em: string | null;
}

interface UseProdutoImportJobsParams {
  empresaId?: string;
}

interface UseProdutoImportJobsReturn {
  emAndamento: ProdutoImportJob[];
  historico: ProdutoImportJob[];
  isLoading: boolean;
  refetch: () => void;
}

export function useProdutoImportJobs(params?: UseProdutoImportJobsParams): UseProdutoImportJobsReturn {
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["produto_import_jobs", params?.empresaId],
    queryFn: async () => {
      let query = supabase
        .from("produto_import_jobs")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(50);

      if (params?.empresaId) {
        query = query.eq("empresa_id", params.empresaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ProdutoImportJob[];
    },
    refetchInterval: (query) => {
      const jobs = query.state.data as ProdutoImportJob[] | undefined;
      const temJobsEmAndamento = jobs?.some(j => j.status === 'processando');
      return temJobsEmAndamento ? 2000 : false;
    },
    refetchIntervalInBackground: true,
    staleTime: 1000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('produto-import-jobs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'produto_import_jobs',
        },
        (payload) => {
          console.log('[Realtime] Produto Job update:', payload.eventType, payload.new);
          
          queryClient.setQueryData(
            ["produto_import_jobs", params?.empresaId],
            (oldData: ProdutoImportJob[] | undefined) => {
              if (!oldData) return oldData;

              if (payload.eventType === 'INSERT') {
                const newJob = payload.new as ProdutoImportJob;
                if (!params?.empresaId || newJob.empresa_id === params.empresaId) {
                  return [newJob, ...oldData];
                }
                return oldData;
              }

              if (payload.eventType === 'UPDATE') {
                const updatedJob = payload.new as ProdutoImportJob;
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

  const emAndamento = jobs.filter(j => j.status === 'processando');
  const historico = jobs.filter(j => j.status !== 'processando').slice(0, 15);

  return {
    emAndamento,
    historico,
    isLoading,
    refetch,
  };
}

// Funções auxiliares para uso direto
export async function criarJobImportacaoProduto(data: {
  empresa_id: string;
  arquivo_nome: string;
  total_linhas: number;
}): Promise<string> {
  const { data: job, error } = await supabase
    .from("produto_import_jobs")
    .insert({
      empresa_id: data.empresa_id,
      arquivo_nome: data.arquivo_nome,
      total_linhas: data.total_linhas,
      linhas_processadas: 0,
      linhas_importadas: 0,
      linhas_atualizadas: 0,
      linhas_com_erro: 0,
      mapeamentos_criados: 0,
      status: 'processando',
      mensagem_erro: null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return job.id;
}

export async function atualizarProgressoJobProduto(jobId: string, updates: {
  linhas_processadas?: number;
  linhas_importadas?: number;
  linhas_atualizadas?: number;
  linhas_com_erro?: number;
  mapeamentos_criados?: number;
}): Promise<void> {
  const { error } = await supabase
    .from("produto_import_jobs")
    .update({
      ...updates,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[Job Produto] Erro ao atualizar progresso:", error);
  }
}

export async function finalizarJobProduto(jobId: string, resultado: {
  status: 'concluido' | 'erro';
  linhas_importadas?: number;
  linhas_atualizadas?: number;
  linhas_com_erro?: number;
  mapeamentos_criados?: number;
  mensagem_erro?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("produto_import_jobs")
    .update({
      status: resultado.status,
      linhas_importadas: resultado.linhas_importadas,
      linhas_atualizadas: resultado.linhas_atualizadas,
      linhas_com_erro: resultado.linhas_com_erro,
      mapeamentos_criados: resultado.mapeamentos_criados,
      mensagem_erro: resultado.mensagem_erro || null,
      finalizado_em: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[Job Produto] Erro ao finalizar job:", error);
  }
}

export async function cancelarJobProduto(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("produto_import_jobs")
    .update({
      status: 'erro',
      mensagem_erro: 'Importação cancelada pelo usuário',
      finalizado_em: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[Job Produto] Erro ao cancelar job:", error);
    throw error;
  }
}

export async function excluirJobProduto(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("produto_import_jobs")
    .delete()
    .eq("id", jobId);

  if (error) {
    console.error("[Job Produto] Erro ao excluir job:", error);
    throw error;
  }
}
