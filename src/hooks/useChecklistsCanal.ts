import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { templatesChecklist, canaisMarketplace } from "@/lib/checklist-data";

// ============= TIPOS =============
export interface ChecklistCanal {
  id: string;
  empresa_id: string;
  canal_id: string;
  canal_nome: string;
  mes: number;
  ano: number;
  status: string;
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ChecklistCanalItem {
  id: string;
  checklist_id: string;
  nome: string;
  descricao: string | null;
  tipo_etapa: string;
  ordem: number;
  status: string;
  obrigatorio: boolean;
  exige_upload: boolean;
  observacoes: string | null;
  data_hora_conclusao: string | null;
  responsavel: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ChecklistCanalArquivo {
  id: string;
  checklist_item_id: string;
  nome_arquivo: string;
  url: string;
  tamanho_bytes: number | null;
  tipo_mime: string | null;
  processado: boolean;
  resultado_processamento: any | null;
  transacoes_importadas: number;
  data_upload: string;
}

export interface ChecklistCanalComItens extends ChecklistCanal {
  itens: (ChecklistCanalItem & { arquivos: ChecklistCanalArquivo[] })[];
}

interface UseChecklistsCanalParams {
  empresaId?: string;
  mes?: number;
  ano?: number;
}

// ============= HOOK PRINCIPAL =============
export function useChecklistsCanal(params?: UseChecklistsCanalParams) {
  const queryClient = useQueryClient();

  // Buscar lista de checklists
  const { data: checklists = [], isLoading, refetch } = useQuery({
    queryKey: ["checklists_canal", params],
    queryFn: async () => {
      let query = supabase
        .from("checklists_canal")
        .select("*")
        .order("criado_em", { ascending: false });

      if (params?.empresaId) {
        query = query.eq("empresa_id", params.empresaId);
      }
      if (params?.mes) {
        query = query.eq("mes", params.mes);
      }
      if (params?.ano) {
        query = query.eq("ano", params.ano);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ChecklistCanal[];
    },
    enabled: !!params?.empresaId,
  });

  // Buscar checklist específico com itens e arquivos
  const buscarChecklistCompleto = async (checklistId: string): Promise<ChecklistCanalComItens | null> => {
    // Buscar checklist
    const { data: checklist, error: checklistError } = await supabase
      .from("checklists_canal")
      .select("*")
      .eq("id", checklistId)
      .single();

    if (checklistError) {
      console.error("Erro ao buscar checklist:", checklistError);
      return null;
    }

    // Buscar itens
    const { data: itens, error: itensError } = await supabase
      .from("checklist_canal_itens")
      .select("*")
      .eq("checklist_id", checklistId)
      .order("ordem");

    if (itensError) {
      console.error("Erro ao buscar itens:", itensError);
      return null;
    }

    // Buscar arquivos para todos os itens
    const itemIds = (itens || []).map(i => i.id);
    const { data: arquivos, error: arquivosError } = await supabase
      .from("checklist_canal_arquivos")
      .select("*")
      .in("checklist_item_id", itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000']);

    if (arquivosError) {
      console.error("Erro ao buscar arquivos:", arquivosError);
    }

    // Montar estrutura completa
    const itensComArquivos = (itens || []).map(item => ({
      ...item,
      arquivos: (arquivos || []).filter(a => a.checklist_item_id === item.id),
    }));

    return {
      ...checklist,
      itens: itensComArquivos,
    } as ChecklistCanalComItens;
  };

  // Criar novo checklist com itens do template
  const criarChecklist = useMutation({
    mutationFn: async ({
      empresaId,
      canalId,
      mes,
      ano,
      descricao,
    }: {
      empresaId: string;
      canalId: string;
      mes: number;
      ano: number;
      descricao?: string;
    }) => {
      const canal = canaisMarketplace.find(c => c.id === canalId);
      const template = templatesChecklist.find(t => t.canalId === canalId);

      if (!canal) {
        throw new Error("Canal não encontrado");
      }

      // Criar checklist
      const { data: checklist, error: checklistError } = await supabase
        .from("checklists_canal")
        .insert({
          empresa_id: empresaId,
          canal_id: canalId,
          canal_nome: canal.nome,
          mes,
          ano,
          status: "pendente",
          descricao: descricao || null,
        })
        .select()
        .single();

      if (checklistError) {
        if (checklistError.code === "23505") {
          throw new Error("Já existe um checklist para este canal e período");
        }
        throw checklistError;
      }

      // Criar itens a partir do template
      if (template && template.itens.length > 0) {
        const itensParaInserir = template.itens.map((item, index) => ({
          checklist_id: checklist.id,
          nome: item.nome,
          descricao: item.descricao || null,
          tipo_etapa: item.tipoEtapa,
          ordem: item.ordem || index + 1,
          status: "pendente",
          obrigatorio: item.obrigatorio,
          exige_upload: item.exigeUpload,
        }));

        const { error: itensError } = await supabase
          .from("checklist_canal_itens")
          .insert(itensParaInserir);

        if (itensError) {
          // Rollback: deletar checklist se inserção de itens falhar
          await supabase.from("checklists_canal").delete().eq("id", checklist.id);
          throw itensError;
        }
      }

      return checklist as ChecklistCanal;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
      toast.success(`Checklist de ${data.canal_nome} criado com sucesso`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar checklist");
    },
  });

  // Atualizar status do checklist
  const atualizarStatusChecklist = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from("checklists_canal")
        .update({ status, atualizado_em: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ChecklistCanal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
    },
  });

  // Criar nova etapa
  const criarEtapa = useMutation({
    mutationFn: async ({
      checklistId,
      nome,
      descricao,
      tipoEtapa,
      obrigatorio,
      exigeUpload,
      ordem,
    }: {
      checklistId: string;
      nome: string;
      descricao?: string;
      tipoEtapa: string;
      obrigatorio: boolean;
      exigeUpload: boolean;
      ordem?: number;
    }) => {
      // Se não passar ordem, pegar a maior ordem existente + 1
      let novaOrdem = ordem;
      if (!novaOrdem) {
        const { data: itens } = await supabase
          .from("checklist_canal_itens")
          .select("ordem")
          .eq("checklist_id", checklistId)
          .order("ordem", { ascending: false })
          .limit(1);

        novaOrdem = (itens && itens.length > 0 ? itens[0].ordem : 0) + 1;
      }

      const { data, error } = await supabase
        .from("checklist_canal_itens")
        .insert({
          checklist_id: checklistId,
          nome,
          descricao: descricao || null,
          tipo_etapa: tipoEtapa,
          ordem: novaOrdem,
          status: "pendente",
          obrigatorio,
          exige_upload: exigeUpload,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ChecklistCanalItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
      toast.success("Etapa criada com sucesso");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar etapa: " + error.message);
    },
  });

  // Atualizar etapa
  const atualizarEtapa = useMutation({
    mutationFn: async ({
      id,
      nome,
      descricao,
      tipoEtapa,
      obrigatorio,
      exigeUpload,
      status,
      observacoes,
    }: {
      id: string;
      nome?: string;
      descricao?: string;
      tipoEtapa?: string;
      obrigatorio?: boolean;
      exigeUpload?: boolean;
      status?: string;
      observacoes?: string;
    }) => {
      const updateData: Record<string, any> = {
        atualizado_em: new Date().toISOString(),
      };

      if (nome !== undefined) updateData.nome = nome;
      if (descricao !== undefined) updateData.descricao = descricao;
      if (tipoEtapa !== undefined) updateData.tipo_etapa = tipoEtapa;
      if (obrigatorio !== undefined) updateData.obrigatorio = obrigatorio;
      if (exigeUpload !== undefined) updateData.exige_upload = exigeUpload;
      if (status !== undefined) {
        updateData.status = status;
        if (status === "concluido") {
          updateData.data_hora_conclusao = new Date().toISOString();
        }
      }
      if (observacoes !== undefined) updateData.observacoes = observacoes;

      const { data, error } = await supabase
        .from("checklist_canal_itens")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ChecklistCanalItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
    },
  });

  // Excluir etapa
  const excluirEtapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("checklist_canal_itens")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
      toast.success("Etapa excluída com sucesso");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir etapa: " + error.message);
    },
  });

  // Marcar etapa como concluída
  const concluirEtapa = useMutation({
    mutationFn: async ({ id, responsavel }: { id: string; responsavel?: string }) => {
      const { data, error } = await supabase
        .from("checklist_canal_itens")
        .update({
          status: "concluido",
          data_hora_conclusao: new Date().toISOString(),
          responsavel: responsavel || "Sistema",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ChecklistCanalItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
      toast.success("Etapa concluída");
    },
  });

  // Adicionar arquivo a uma etapa
  const adicionarArquivo = useMutation({
    mutationFn: async ({
      checklistItemId,
      nomeArquivo,
      url,
      tamanhoBytes,
      tipoMime,
    }: {
      checklistItemId: string;
      nomeArquivo: string;
      url: string;
      tamanhoBytes?: number;
      tipoMime?: string;
    }) => {
      const { data, error } = await supabase
        .from("checklist_canal_arquivos")
        .insert({
          checklist_item_id: checklistItemId,
          nome_arquivo: nomeArquivo,
          url,
          tamanho_bytes: tamanhoBytes || null,
          tipo_mime: tipoMime || null,
          processado: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ChecklistCanalArquivo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
    },
  });

  // Marcar arquivo como processado
  const marcarArquivoProcessado = useMutation({
    mutationFn: async ({
      id,
      resultado,
      transacoesImportadas,
    }: {
      id: string;
      resultado: any;
      transacoesImportadas: number;
    }) => {
      const { data, error } = await supabase
        .from("checklist_canal_arquivos")
        .update({
          processado: true,
          resultado_processamento: resultado,
          transacoes_importadas: transacoesImportadas,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ChecklistCanalArquivo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
    },
  });

  // Remover arquivo
  const removerArquivo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("checklist_canal_arquivos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
      toast.success("Arquivo removido");
    },
  });

  // Excluir checklist
  const excluirChecklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("checklists_canal")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists_canal"] });
      toast.success("Checklist excluído");
    },
  });

  // Função auxiliar para calcular progresso
  const calcularProgresso = (itens: ChecklistCanalItem[]) => {
    const obrigatorios = itens.filter(i => i.obrigatorio);
    const concluidos = obrigatorios.filter(i => i.status === "concluido" || i.status === "nao_aplicavel");
    const percentual = obrigatorios.length > 0 
      ? Math.round((concluidos.length / obrigatorios.length) * 100) 
      : 0;

    return {
      total: obrigatorios.length,
      concluidos: concluidos.length,
      percentual,
    };
  };

  // Função auxiliar para determinar status do checklist
  const determinarStatus = (itens: ChecklistCanalItem[]): string => {
    if (itens.length === 0) return "pendente";

    const obrigatorios = itens.filter(i => i.obrigatorio);
    const todosObrigatoriosConcluidos = obrigatorios.every(
      i => i.status === "concluido" || i.status === "nao_aplicavel"
    );

    if (todosObrigatoriosConcluidos) return "concluido";

    const algumEmAndamento = itens.some(i => i.status === "em_andamento" || i.status === "concluido");
    if (algumEmAndamento) return "em_andamento";

    return "pendente";
  };

  return {
    checklists,
    isLoading,
    refetch,
    buscarChecklistCompleto,
    criarChecklist,
    atualizarStatusChecklist,
    criarEtapa,
    atualizarEtapa,
    excluirEtapa,
    concluirEtapa,
    adicionarArquivo,
    marcarArquivoProcessado,
    removerArquivo,
    excluirChecklist,
    calcularProgresso,
    determinarStatus,
  };
}
