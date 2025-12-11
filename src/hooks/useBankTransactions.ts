import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registrarMovimentoFinanceiro, removerMovimentoFinanceiro } from "@/lib/movimentos-financeiros";

export interface BankTransaction {
  id: string;
  conta_id: string | null;
  empresa_id: string;
  data_transacao: string;
  data_competencia: string | null;
  descricao: string;
  documento: string | null;
  valor: number;
  tipo_lancamento: "debito" | "credito";
  status: "importado" | "pendente" | "conciliado" | "ignorado";
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  origem_extrato: "arquivo_ofx" | "arquivo_csv" | "arquivo_xlsx" | "manual";
  referencia_externa: string | null;
  criado_em: string;
  atualizado_em: string;
  // Joins
  categoria?: { id: string; nome: string; tipo: string } | null;
  centro_custo?: { id: string; nome: string; codigo: string | null } | null;
  empresa?: { id: string; razao_social: string; nome_fantasia: string | null } | null;
}

interface UseBankTransactionsParams {
  empresaId?: string;
  periodoInicio?: string;
  periodoFim?: string;
  status?: string;
  contaId?: string;
}

export function useBankTransactions({
  empresaId,
  periodoInicio,
  periodoFim,
  status,
  contaId,
}: UseBankTransactionsParams = {}) {
  const queryClient = useQueryClient();

  const { data: transacoes, isLoading, refetch } = useQuery({
    queryKey: ["bank_transactions", empresaId, periodoInicio, periodoFim, status, contaId],
    queryFn: async () => {
      let query = supabase
        .from("bank_transactions")
        .select(`
          *,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome, codigo),
          empresa:empresas(id, razao_social, nome_fantasia)
        `)
        .order("data_transacao", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }
      if (periodoInicio) {
        query = query.gte("data_transacao", periodoInicio);
      }
      if (periodoFim) {
        query = query.lte("data_transacao", periodoFim);
      }
      if (status && status !== "todos") {
        query = query.eq("status", status);
      }
      if (contaId) {
        query = query.eq("conta_id", contaId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar transações bancárias:", error);
        throw error;
      }

      return data as BankTransaction[];
    },
  });

  // Resumo das transações
  const resumo = {
    total: transacoes?.length || 0,
    importadas: transacoes?.filter((t) => t.status === "importado").length || 0,
    pendentes: transacoes?.filter((t) => t.status === "pendente").length || 0,
    conciliadas: transacoes?.filter((t) => t.status === "conciliado").length || 0,
    ignoradas: transacoes?.filter((t) => t.status === "ignorado").length || 0,
    totalCreditos: transacoes?.filter((t) => t.tipo_lancamento === "credito").reduce((acc, t) => acc + t.valor, 0) || 0,
    totalDebitos: transacoes?.filter((t) => t.tipo_lancamento === "debito").reduce((acc, t) => acc + t.valor, 0) || 0,
  };

  // Inserir transações em lote (importação) - Processamento em batches para evitar timeout
  const importarTransacoes = useMutation({
    mutationFn: async ({ 
      transacoes, 
      onProgress 
    }: { 
      transacoes: Omit<BankTransaction, "id" | "criado_em" | "atualizado_em" | "categoria" | "centro_custo" | "empresa">[];
      onProgress?: (progresso: number, mensagem: string) => void;
    }) => {
      const BATCH_SIZE = 50;
      
      onProgress?.(5, "Verificando duplicatas...");
      
      // Verificar duplicatas por referencia_externa
      const referencias = transacoes.map((t) => t.referencia_externa).filter(Boolean);
      
      let existentes: string[] = [];
      if (referencias.length > 0) {
        const { data } = await supabase
          .from("bank_transactions")
          .select("referencia_externa")
          .in("referencia_externa", referencias as string[]);
        
        existentes = (data || []).map((d) => d.referencia_externa as string);
      }

      onProgress?.(15, "Filtrando transações novas...");

      // Filtrar apenas transações novas
      const novas = transacoes.filter(
        (t) => !t.referencia_externa || !existentes.includes(t.referencia_externa)
      );

      if (novas.length === 0) {
        onProgress?.(100, "Concluído - todas duplicadas");
        return { importadas: 0, duplicadas: transacoes.length };
      }

      // Processar em batches de 50 para evitar timeout
      let totalImportadas = 0;
      const totalBatches = Math.ceil(novas.length / BATCH_SIZE);

      for (let i = 0; i < novas.length; i += BATCH_SIZE) {
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const batch = novas.slice(i, i + BATCH_SIZE);
        
        const progressoBase = 20;
        const progressoTotal = 95;
        const progressoAtual = progressoBase + ((batchIndex / totalBatches) * (progressoTotal - progressoBase));
        
        onProgress?.(
          Math.round(progressoAtual), 
          `Importando lote ${batchIndex}/${totalBatches} (${totalImportadas + batch.length}/${novas.length})...`
        );

        const { error } = await supabase
          .from("bank_transactions")
          .insert(batch);

        if (error) {
          console.error(`Erro no batch ${batchIndex}:`, error);
          throw new Error(`Erro ao importar lote ${batchIndex}: ${error.message}`);
        }

        totalImportadas += batch.length;
      }

      onProgress?.(100, "Importação concluída!");

      return { 
        importadas: totalImportadas, 
        duplicadas: transacoes.length - novas.length 
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      if (result.duplicadas > 0) {
        toast.success(`${result.importadas} transações importadas. ${result.duplicadas} duplicadas ignoradas.`);
      } else {
        toast.success(`${result.importadas} transações importadas com sucesso`);
      }
    },
    onError: (error: any) => {
      console.error("Erro ao importar transações:", error);
      toast.error(error.message || "Erro ao importar transações bancárias");
    },
  });

  // Atualizar transação (categorização)
  const atualizarTransacao = useMutation({
    mutationFn: async ({
      id,
      categoria_id,
      centro_custo_id,
      responsavel_id,
    }: {
      id: string;
      categoria_id?: string | null;
      centro_custo_id?: string | null;
      responsavel_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .update({
          categoria_id,
          centro_custo_id,
          responsavel_id,
          status: "pendente", // Muda para pendente após categorizar
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      toast.success("Transação atualizada");
    },
    onError: (error) => {
      console.error("Erro ao atualizar transação:", error);
      toast.error("Erro ao atualizar transação");
    },
  });

  // Conciliar transação (registra no FLOW HUB)
  const conciliarTransacao = useMutation({
    mutationFn: async (transacao: BankTransaction) => {
      // Validações
      if (!transacao.categoria_id) {
        throw new Error("Categoria é obrigatória para conciliar");
      }

      // Atualizar status na tabela bank_transactions
      const { error: updateError } = await supabase
        .from("bank_transactions")
        .update({ status: "conciliado" })
        .eq("id", transacao.id);

      if (updateError) throw updateError;

      // Buscar nome da categoria e centro de custo
      let categoriaNome = transacao.categoria?.nome || null;
      let centroCustoNome = transacao.centro_custo?.nome || null;

      if (!categoriaNome && transacao.categoria_id) {
        const { data: cat } = await supabase
          .from("categorias_financeiras")
          .select("nome")
          .eq("id", transacao.categoria_id)
          .single();
        categoriaNome = cat?.nome || null;
      }

      if (!centroCustoNome && transacao.centro_custo_id) {
        const { data: cc } = await supabase
          .from("centros_de_custo")
          .select("nome")
          .eq("id", transacao.centro_custo_id)
          .single();
        centroCustoNome = cc?.nome || null;
      }

      // Registrar no FLOW HUB
      await registrarMovimentoFinanceiro({
        data: transacao.data_transacao,
        tipo: transacao.tipo_lancamento === "debito" ? "saida" : "entrada",
        origem: "banco",
        descricao: transacao.documento 
          ? `${transacao.descricao} - ${transacao.documento}` 
          : transacao.descricao,
        valor: Math.abs(transacao.valor),
        empresaId: transacao.empresa_id,
        referenciaId: transacao.id,
        categoriaId: transacao.categoria_id,
        categoriaNome,
        centroCustoId: transacao.centro_custo_id || undefined,
        centroCustoNome: centroCustoNome || undefined,
        responsavelId: transacao.responsavel_id || undefined,
        formaPagamento: "conta_bancaria",
      });

      return transacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo-caixa"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Transação conciliada e registrada no fluxo de caixa");
    },
    onError: (error: any) => {
      console.error("Erro ao conciliar transação:", error);
      toast.error(error.message || "Erro ao conciliar transação");
    },
  });

  // Ignorar transação
  const ignorarTransacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_transactions")
        .update({ status: "ignorado" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      toast.success("Transação ignorada");
    },
    onError: (error) => {
      console.error("Erro ao ignorar transação:", error);
      toast.error("Erro ao ignorar transação");
    },
  });

  // Reabrir transação (desfaz conciliação)
  const reabrirTransacao = useMutation({
    mutationFn: async (transacao: BankTransaction) => {
      // Remover do FLOW HUB se estava conciliada
      if (transacao.status === "conciliado") {
        await removerMovimentoFinanceiro(transacao.id, "banco");
      }

      // Atualizar status para pendente
      const { error } = await supabase
        .from("bank_transactions")
        .update({ status: "pendente" })
        .eq("id", transacao.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo-caixa"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Transação reaberta");
    },
    onError: (error) => {
      console.error("Erro ao reabrir transação:", error);
      toast.error("Erro ao reabrir transação");
    },
  });

  return {
    transacoes: transacoes || [],
    resumo,
    isLoading,
    refetch,
    importarTransacoes,
    atualizarTransacao,
    conciliarTransacao,
    ignorarTransacao,
    reabrirTransacao,
  };
}
