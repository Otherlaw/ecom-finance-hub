/**
 * Hook para gerenciar jobs de importação de arquivos do checklist
 * Segue o mesmo padrão do useMarketplaceImportJobs
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
export interface ChecklistImportJob {
  id: string;
  empresa_id: string;
  checklist_item_id: string;
  arquivo_id: string | null;
  arquivo_nome: string;
  canal: string;
  total_linhas: number;
  linhas_processadas: number;
  linhas_importadas: number;
  linhas_duplicadas: number;
  linhas_com_erro: number;
  status: "processando" | "concluido" | "erro" | "cancelado";
  fase: "iniciando" | "baixando" | "parsing" | "verificando_duplicatas" | "inserindo" | "finalizando";
  mensagem_erro: string | null;
  resultado_processamento: Record<string, unknown> | null;
  criado_em: string;
  atualizado_em: string;
  finalizado_em: string | null;
}

interface UseChecklistImportJobsParams {
  empresaId?: string;
  checklistItemId?: string;
}

export function useChecklistImportJobs(params?: UseChecklistImportJobsParams) {
  const queryClient = useQueryClient();
  const { empresaAtiva } = useEmpresaAtiva();
  // Permite override de empresaId via props (crítico para quando contexto diverge)
  const empresaId = params?.empresaId ?? empresaAtiva?.id;
  const checklistItemId = params?.checklistItemId;

  // Query para buscar jobs
  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ["checklist-import-jobs", empresaId, checklistItemId],
    queryFn: async () => {
      if (!empresaId) return [];

      let query = supabase
        .from("checklist_import_jobs")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("criado_em", { ascending: false })
        .limit(20);

      if (checklistItemId) {
        query = query.eq("checklist_item_id", checklistItemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ChecklistImportJob[];
    },
    enabled: !!empresaId,
    staleTime: 5000,
    // Polling agressivo quando há jobs processando
    refetchInterval: (query) => {
      const data = query.state.data as ChecklistImportJob[] | undefined;
      const hasProcessing = data?.some((j) => j.status === "processando");
      return hasProcessing ? 2000 : false;
    },
  });

  // Realtime subscription para atualizações instantâneas
  useEffect(() => {
    if (!empresaId) return;

    const channel = supabase
      .channel("checklist-import-jobs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checklist_import_jobs",
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["checklist-import-jobs", empresaId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId, queryClient]);

  // Separar jobs em andamento e histórico
  const emAndamento = jobs?.filter((j) => j.status === "processando") || [];
  const historico = jobs?.filter((j) => j.status !== "processando") || [];

  // Mutation para criar job
  const criarJob = useMutation({
    mutationFn: async (data: {
      checklistItemId: string;
      arquivoId?: string;
      arquivoNome: string;
      canal: string;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada");

      const { data: job, error } = await supabase
        .from("checklist_import_jobs")
        .insert({
          empresa_id: empresaId,
          checklist_item_id: data.checklistItemId,
          arquivo_id: data.arquivoId || null,
          arquivo_nome: data.arquivoNome,
          canal: data.canal,
          status: "processando",
          fase: "iniciando",
        })
        .select()
        .single();

      if (error) throw error;
      return job as ChecklistImportJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["checklist-import-jobs", empresaId],
      });
    },
  });

  // Mutation para cancelar job
  const cancelarJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("checklist_import_jobs")
        .update({
          status: "cancelado",
          mensagem_erro: "Cancelado pelo usuário",
          finalizado_em: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("Processamento cancelado");
      queryClient.invalidateQueries({
        queryKey: ["checklist-import-jobs", empresaId],
      });
    },
  });

  return {
    jobs,
    emAndamento,
    historico,
    isLoading,
    refetch,
    criarJob,
    cancelarJob,
  };
}

// === Funções auxiliares para uso direto (sem hook) ===

export async function criarJobChecklistImportacao(data: {
  empresaId: string;
  checklistItemId: string;
  arquivoId?: string;
  arquivoNome: string;
  canal: string;
}): Promise<string> {
  const { data: job, error } = await supabase
    .from("checklist_import_jobs")
    .insert({
      empresa_id: data.empresaId,
      checklist_item_id: data.checklistItemId,
      arquivo_id: data.arquivoId || null,
      arquivo_nome: data.arquivoNome,
      canal: data.canal,
      status: "processando",
      fase: "iniciando",
    })
    .select("id")
    .single();

  if (error) throw error;
  return job.id;
}

export async function atualizarFaseJob(
  jobId: string,
  fase: ChecklistImportJob["fase"]
): Promise<void> {
  const { error } = await supabase
    .from("checklist_import_jobs")
    .update({ fase })
    .eq("id", jobId);

  if (error) console.error("Erro ao atualizar fase do job:", error);
}

export async function atualizarProgressoJob(
  jobId: string,
  updates: Partial<{
    total_linhas: number;
    linhas_processadas: number;
    linhas_importadas: number;
    linhas_duplicadas: number;
    linhas_com_erro: number;
  }>
): Promise<void> {
  const { error } = await supabase
    .from("checklist_import_jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) console.error("Erro ao atualizar progresso do job:", error);
}

export async function finalizarJobChecklist(
  jobId: string,
  resultado: {
    sucesso: boolean;
    linhasImportadas: number;
    linhasDuplicadas: number;
    linhasComErro: number;
    mensagemErro?: string;
    resultadoProcessamento?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase
    .from("checklist_import_jobs")
    .update({
      status: resultado.sucesso ? "concluido" : "erro",
      fase: "finalizando",
      linhas_importadas: resultado.linhasImportadas,
      linhas_duplicadas: resultado.linhasDuplicadas,
      linhas_com_erro: resultado.linhasComErro,
      mensagem_erro: resultado.mensagemErro || null,
      resultado_processamento: (resultado.resultadoProcessamento || null) as unknown as null,
      finalizado_em: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) console.error("Erro ao finalizar job:", error);
}

export async function verificarJobCancelado(jobId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("checklist_import_jobs")
    .select("status")
    .eq("id", jobId)
    .single();

  if (error) return false;
  return data?.status === "cancelado";
}
