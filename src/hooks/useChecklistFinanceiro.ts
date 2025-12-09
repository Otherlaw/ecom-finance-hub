import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ETAPAS_PADRAO, SECOES_CHECKLIST, type SecaoId } from "@/lib/checklist-data";

export interface ChecklistEtapa {
  id: string;
  empresa_id: string;
  ano: number;
  mes: number;
  secao: string;
  codigo_etapa: string;
  nome_etapa: string;
  descricao: string | null;
  importancia: string | null;
  link_acao: string | null;
  status: 'pendente' | 'concluido' | 'nao_aplicavel';
  pendencias: number;
  concluidas: number;
  updated_at: string;
  created_at: string;
}

interface UseChecklistParams {
  empresaId?: string;
  mes: number;
  ano: number;
}

export const useChecklistFinanceiro = ({ empresaId, mes, ano }: UseChecklistParams) => {
  const queryClient = useQueryClient();

  // Buscar etapas do checklist
  const { data: etapas, isLoading, refetch } = useQuery({
    queryKey: ["checklist-financeiro", empresaId, mes, ano],
    queryFn: async () => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("checklist_etapas")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ano", ano)
        .eq("mes", mes)
        .order("secao")
        .order("codigo_etapa");

      if (error) throw error;
      return data as ChecklistEtapa[];
    },
    enabled: !!empresaId,
  });

  // Inicializar checklist do mês se não existir
  const inicializarChecklist = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não selecionada");

      // Verificar se já existe
      const { count } = await supabase
        .from("checklist_etapas")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("ano", ano)
        .eq("mes", mes);

      if (count && count > 0) return;

      // Criar etapas padrão
      const etapasParaInserir = ETAPAS_PADRAO.map((etapa) => ({
        empresa_id: empresaId,
        ano,
        mes,
        secao: etapa.secao,
        codigo_etapa: etapa.codigo,
        nome_etapa: etapa.nome,
        descricao: etapa.descricao,
        importancia: etapa.importancia,
        link_acao: etapa.linkAcao,
        status: 'pendente',
        pendencias: 0,
        concluidas: 0,
      }));

      const { error } = await supabase
        .from("checklist_etapas")
        .insert(etapasParaInserir);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-financeiro"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao inicializar checklist: " + error.message);
    },
  });

  // Recalcular pendências automaticamente
  const recalcularPendencias = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não selecionada");

      const inicioMes = format(startOfMonth(new Date(ano, mes - 1)), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date(ano, mes - 1)), "yyyy-MM-dd");

      // Buscar pendências de cada tipo em paralelo
      const [
        bancariasResult,
        cartoesResult,
        marketplaceResult,
        contasPagarResult,
        contasReceberResult,
        comprasResult,
        cmvResult,
        mlTransResult,
        shopeeTransResult,
        sheinTransResult,
        tiktokTransResult,
      ] = await Promise.all([
        // Conciliação bancária - transações importadas não conciliadas
        supabase
          .from("bank_transactions")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("status", "importado")
          .gte("data_transacao", inicioMes)
          .lte("data_transacao", fimMes),

        // Conciliação cartões - transações pendentes
        supabase
          .from("credit_card_transactions")
          .select("*", { count: "exact", head: true })
          .eq("status", "pendente"),

        // Conciliação marketplace - transações importadas
        supabase
          .from("marketplace_transactions")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("status", "importado")
          .gte("data_transacao", inicioMes)
          .lte("data_transacao", fimMes),

        // Contas a pagar sem categoria ou em aberto
        supabase
          .from("contas_a_pagar")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .or("status.eq.em_aberto,categoria_id.is.null")
          .gte("data_vencimento", inicioMes)
          .lte("data_vencimento", fimMes),

        // Contas a receber pendentes
        supabase
          .from("contas_a_receber")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("status", "pendente")
          .gte("data_vencimento", inicioMes)
          .lte("data_vencimento", fimMes),

        // Compras pendentes (não concluídas)
        supabase
          .from("compras")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .in("status", ["emitido", "parcial", "em_transito"])
          .gte("data_pedido", inicioMes)
          .lte("data_pedido", fimMes),

        // CMV registros do período
        supabase
          .from("cmv_registros")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .gte("data", inicioMes)
          .lte("data", fimMes),

        // Transações Mercado Livre pendentes
        supabase
          .from("marketplace_transactions")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("canal", "mercado_livre")
          .eq("status", "importado")
          .gte("data_transacao", inicioMes)
          .lte("data_transacao", fimMes),

        // Transações Shopee pendentes
        supabase
          .from("marketplace_transactions")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("canal", "shopee")
          .eq("status", "importado")
          .gte("data_transacao", inicioMes)
          .lte("data_transacao", fimMes),

        // Transações Shein pendentes
        supabase
          .from("marketplace_transactions")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("canal", "shein")
          .eq("status", "importado")
          .gte("data_transacao", inicioMes)
          .lte("data_transacao", fimMes),

        // Transações TikTok pendentes
        supabase
          .from("marketplace_transactions")
          .select("*", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("canal", "tiktok")
          .eq("status", "importado")
          .gte("data_transacao", inicioMes)
          .lte("data_transacao", fimMes),
      ]);

      // Mapeamento de pendências por código de etapa
      const pendenciasPorEtapa: Record<string, number> = {
        conciliacao_bancaria: bancariasResult.count || 0,
        conciliacao_cartoes: cartoesResult.count || 0,
        conciliacao_marketplace: marketplaceResult.count || 0,
        contas_pagar_revisadas: contasPagarResult.count || 0,
        contas_receber_revisadas: contasReceberResult.count || 0,
        nfes_importadas: comprasResult.count || 0,
        estoque_confirmado: comprasResult.count || 0,
        cmv_calculado: cmvResult.count === 0 ? 1 : 0, // Pendente se não há registros
        ml_pendencias_zeradas: mlTransResult.count || 0,
        ml_vendas_importadas: mlTransResult.count === 0 ? 1 : 0,
        ml_tarifas_importadas: mlTransResult.count === 0 ? 1 : 0,
        ml_devolucoes_revisadas: mlTransResult.count || 0,
        shopee_vendas_importadas: shopeeTransResult.count === 0 ? 1 : 0,
        shopee_taxas_conferidas: shopeeTransResult.count || 0,
        shopee_pendencias_zeradas: shopeeTransResult.count || 0,
        shein_vendas_importadas: sheinTransResult.count === 0 ? 1 : 0,
        shein_pendencias_zeradas: sheinTransResult.count || 0,
        tiktok_vendas_importadas: tiktokTransResult.count === 0 ? 1 : 0,
        tiktok_pendencias_zeradas: tiktokTransResult.count || 0,
      };

      // Atualizar pendências em batch
      for (const [codigo, pendencias] of Object.entries(pendenciasPorEtapa)) {
        const novoStatus = pendencias > 0 ? 'pendente' : undefined;
        
        await supabase
          .from("checklist_etapas")
          .update({ 
            pendencias,
            ...(novoStatus && { status: novoStatus }),
            updated_at: new Date().toISOString()
          })
          .eq("empresa_id", empresaId)
          .eq("ano", ano)
          .eq("mes", mes)
          .eq("codigo_etapa", codigo);
      }

      return pendenciasPorEtapa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-financeiro"] });
      toast.success("Pendências recalculadas!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao recalcular: " + error.message);
    },
  });

  // Marcar etapa como concluída
  const marcarConcluido = useMutation({
    mutationFn: async (etapaId: string) => {
      const etapa = etapas?.find(e => e.id === etapaId);
      if (!etapa) throw new Error("Etapa não encontrada");
      
      if (etapa.pendencias > 0) {
        throw new Error("Resolva todas as pendências antes de concluir");
      }

      const { error } = await supabase
        .from("checklist_etapas")
        .update({ 
          status: 'concluido',
          updated_at: new Date().toISOString()
        })
        .eq("id", etapaId);

      if (error) throw error;

      // Registrar log
      await supabase.from("checklist_logs").insert({
        etapa_id: etapaId,
        acao: 'marcou_concluido',
        detalhes: { codigo: etapa.codigo_etapa },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-financeiro"] });
      toast.success("Etapa marcada como concluída!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Marcar etapa como pendente
  const marcarPendente = useMutation({
    mutationFn: async (etapaId: string) => {
      const etapa = etapas?.find(e => e.id === etapaId);
      if (!etapa) throw new Error("Etapa não encontrada");

      const { error } = await supabase
        .from("checklist_etapas")
        .update({ 
          status: 'pendente',
          updated_at: new Date().toISOString()
        })
        .eq("id", etapaId);

      if (error) throw error;

      // Registrar log
      await supabase.from("checklist_logs").insert({
        etapa_id: etapaId,
        acao: 'marcou_pendente',
        detalhes: { codigo: etapa.codigo_etapa },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-financeiro"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Agrupar etapas por seção
  const etapasPorSecao = etapas?.reduce((acc, etapa) => {
    const secao = etapa.secao as SecaoId;
    if (!acc[secao]) acc[secao] = [];
    acc[secao].push(etapa);
    return acc;
  }, {} as Record<SecaoId, ChecklistEtapa[]>) || {};

  // Calcular progresso
  const totalEtapas = etapas?.length || 0;
  const etapasConcluidas = etapas?.filter(e => e.status === 'concluido').length || 0;
  const percentualConcluido = totalEtapas > 0 
    ? Math.round((etapasConcluidas / totalEtapas) * 100) 
    : 0;

  return {
    etapas,
    etapasPorSecao,
    isLoading,
    refetch,
    inicializarChecklist,
    recalcularPendencias,
    marcarConcluido,
    marcarPendente,
    totalEtapas,
    etapasConcluidas,
    percentualConcluido,
    secoes: SECOES_CHECKLIST,
  };
};
