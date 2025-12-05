import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

  // Query com polling de 3 segundos quando houver job processando
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
    refetchInterval: (query) => {
      // Polling de 3 segundos se houver job processando
      const data = query.state.data as MarketplaceImportJob[] | undefined;
      const hasProcessing = data?.some(j => j.status === 'processando');
      return hasProcessing ? 3000 : false;
    },
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_import_jobs"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_import_jobs"] });
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
    .update(updates)
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
