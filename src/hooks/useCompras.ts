/**
 * Hook para gerenciamento de compras - Nova Estrutura V2
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export type StatusCompra = 'rascunho' | 'pago' | 'em_transito' | 'parcial' | 'concluido' | 'cancelado';

export const STATUS_LIST: StatusCompra[] = ['rascunho', 'pago', 'em_transito', 'parcial', 'concluido', 'cancelado'];

export const STATUS_COMPRA_LABELS: Record<StatusCompra, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
  pago: { label: "Pago", color: "bg-blue-100 text-blue-800" },
  em_transito: { label: "Em Trânsito", color: "bg-yellow-100 text-yellow-800" },
  parcial: { label: "Parcial", color: "bg-orange-100 text-orange-800" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

export interface CompraItem {
  id: string;
  compra_id: string;
  produto_id: string | null;
  codigo_nf: string | null;
  descricao_nf: string;
  ncm: string | null;
  cfop: string | null;
  quantidade: number;
  quantidade_recebida: number;
  valor_unitario: number;
  valor_total: number;
  aliquota_icms: number | null;
  valor_icms: number | null;
  aliquota_ipi: number | null;
  valor_ipi: number | null;
  mapeado: boolean;
  created_at: string;
  updated_at: string;
}

export interface Compra {
  id: string;
  empresa_id: string;
  numero: string | null;
  fornecedor_nome: string;
  fornecedor_cnpj: string | null;
  data_pedido: string;
  data_previsao: string | null;
  valor_produtos: number;
  valor_frete: number;
  valor_desconto: number;
  valor_total: number;
  numero_nf: string | null;
  chave_acesso: string | null;
  data_nf: string | null;
  status: StatusCompra;
  armazem_destino_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  itens?: CompraItem[];
}

export interface CompraInsert {
  empresa_id: string;
  numero?: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  data_pedido: string;
  data_previsao?: string;
  valor_produtos?: number;
  valor_frete?: number;
  valor_desconto?: number;
  valor_total?: number;
  numero_nf?: string;
  chave_acesso?: string;
  data_nf?: string;
  status?: StatusCompra;
  armazem_destino_id?: string;
  observacoes?: string;
}

export interface UseComprasParams {
  empresaId?: string;
  status?: StatusCompra | 'todos';
  busca?: string;
}

// ============= HOOK PRINCIPAL =============

export function useCompras(params: UseComprasParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, status = 'todos', busca } = params;

  const {
    data: compras = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["compras", empresaId, status, busca],
    queryFn: async () => {
      let query = supabase
        .from("compras")
        .select(`
          *,
          itens:compras_itens(*)
        `)
        .order("data_pedido", { ascending: false });

      if (empresaId) query = query.eq("empresa_id", empresaId);
      if (status && status !== 'todos') query = query.eq("status", status);
      if (busca) query = query.or(`fornecedor_nome.ilike.%${busca}%,numero_nf.ilike.%${busca}%`);

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar compras:", error);
        throw error;
      }

      return (data || []).map((c): Compra => ({
        id: c.id,
        empresa_id: c.empresa_id,
        numero: c.numero,
        fornecedor_nome: c.fornecedor_nome,
        fornecedor_cnpj: c.fornecedor_cnpj,
        data_pedido: c.data_pedido,
        data_previsao: c.data_previsao,
        valor_produtos: Number(c.valor_produtos) || 0,
        valor_frete: Number(c.valor_frete) || 0,
        valor_desconto: Number(c.valor_desconto) || 0,
        valor_total: Number(c.valor_total) || 0,
        numero_nf: c.numero_nf,
        chave_acesso: c.chave_acesso,
        data_nf: c.data_nf,
        status: c.status as StatusCompra,
        armazem_destino_id: c.armazem_destino_id,
        observacoes: c.observacoes,
        created_at: c.created_at,
        updated_at: c.updated_at,
        itens: (c.itens || []).map((i: any): CompraItem => ({
          id: i.id,
          compra_id: i.compra_id,
          produto_id: i.produto_id,
          codigo_nf: i.codigo_nf,
          descricao_nf: i.descricao_nf,
          ncm: i.ncm,
          cfop: i.cfop,
          quantidade: Number(i.quantidade) || 0,
          quantidade_recebida: Number(i.quantidade_recebida) || 0,
          valor_unitario: Number(i.valor_unitario) || 0,
          valor_total: Number(i.valor_total) || 0,
          aliquota_icms: i.aliquota_icms ? Number(i.aliquota_icms) : null,
          valor_icms: i.valor_icms ? Number(i.valor_icms) : null,
          aliquota_ipi: i.aliquota_ipi ? Number(i.aliquota_ipi) : null,
          valor_ipi: i.valor_ipi ? Number(i.valor_ipi) : null,
          mapeado: i.mapeado || false,
          created_at: i.created_at,
          updated_at: i.updated_at,
        })),
      }));
    },
  });

  // Criar compra
  const criarCompra = useMutation({
    mutationFn: async (input: CompraInsert & { itens?: Omit<CompraItem, 'id' | 'compra_id' | 'created_at' | 'updated_at'>[] }) => {
      const { itens, ...compraData } = input;
      
      const { data: compra, error: compraError } = await supabase
        .from("compras")
        .insert({
          empresa_id: compraData.empresa_id,
          numero: compraData.numero || null,
          fornecedor_nome: compraData.fornecedor_nome,
          fornecedor_cnpj: compraData.fornecedor_cnpj || null,
          data_pedido: compraData.data_pedido,
          data_previsao: compraData.data_previsao || null,
          valor_produtos: compraData.valor_produtos || 0,
          valor_frete: compraData.valor_frete || 0,
          valor_desconto: compraData.valor_desconto || 0,
          valor_total: compraData.valor_total || 0,
          numero_nf: compraData.numero_nf || null,
          chave_acesso: compraData.chave_acesso || null,
          data_nf: compraData.data_nf || null,
          status: compraData.status || 'rascunho',
          armazem_destino_id: compraData.armazem_destino_id || null,
          observacoes: compraData.observacoes || null,
        })
        .select()
        .single();

      if (compraError) throw compraError;

      if (itens && itens.length > 0) {
        const itensParaInserir = itens.map(item => ({
          compra_id: compra.id,
          produto_id: item.produto_id || null,
          codigo_nf: item.codigo_nf || null,
          descricao_nf: item.descricao_nf,
          ncm: item.ncm || null,
          cfop: item.cfop || null,
          quantidade: item.quantidade,
          quantidade_recebida: 0,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          aliquota_icms: item.aliquota_icms || null,
          valor_icms: item.valor_icms || null,
          aliquota_ipi: item.aliquota_ipi || null,
          valor_ipi: item.valor_ipi || null,
          mapeado: item.mapeado || false,
        }));

        const { error: itensError } = await supabase
          .from("compras_itens")
          .insert(itensParaInserir);

        if (itensError) throw itensError;
      }

      return compra;
    },
    onSuccess: () => {
      toast.success("Compra criada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar compra:", error);
      toast.error(`Erro ao criar compra: ${error.message}`);
    },
  });

  // Atualizar status
  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusCompra }) => {
      const { error } = await supabase
        .from("compras")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });

  // Excluir compra
  const excluirCompra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compra excluída");
      queryClient.invalidateQueries({ queryKey: ["compras"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    total: compras.length,
    rascunho: compras.filter(c => c.status === 'rascunho').length,
    pago: compras.filter(c => c.status === 'pago').length,
    em_transito: compras.filter(c => c.status === 'em_transito').length,
    parcial: compras.filter(c => c.status === 'parcial').length,
    concluido: compras.filter(c => c.status === 'concluido').length,
    cancelado: compras.filter(c => c.status === 'cancelado').length,
    valorTotal: compras.reduce((sum, c) => sum + c.valor_total, 0),
    itensNaoMapeados: compras.reduce((sum, c) => 
      sum + (c.itens?.filter(i => !i.mapeado).length || 0), 0),
  };

  return {
    compras,
    isLoading,
    refetch,
    resumo,
    criarCompra,
    atualizarStatus,
    excluirCompra,
  };
}

// ============= HOOK PARA RECEBIMENTOS =============

export function useRecebimentos(compraId: string | null) {
  const queryClient = useQueryClient();

  const { data: recebimentos = [], isLoading } = useQuery({
    queryKey: ["recebimentos", compraId],
    enabled: !!compraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos")
        .select(`
          *,
          itens:recebimentos_itens(*)
        `)
        .eq("compra_id", compraId)
        .order("data_recebimento", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Registrar recebimento
  const registrarRecebimento = useMutation({
    mutationFn: async (input: {
      compra_id: string;
      armazem_id: string;
      data_recebimento: string;
      observacoes?: string;
      itens: {
        compra_item_id: string;
        produto_id: string | null;
        quantidade_recebida: number;
        quantidade_devolvida?: number;
        custo_unitario: number;
        lote?: string;
        validade?: string;
        localizacao?: string;
        observacao?: string;
      }[];
    }) => {
      // Criar registro de recebimento
      const { data: recebimento, error: recError } = await supabase
        .from("recebimentos")
        .insert({
          compra_id: input.compra_id,
          armazem_id: input.armazem_id,
          data_recebimento: input.data_recebimento,
          observacoes: input.observacoes || null,
        })
        .select()
        .single();

      if (recError) throw recError;

      // Inserir itens do recebimento
      const itensParaInserir = input.itens
        .filter(item => item.quantidade_recebida > 0)
        .map(item => ({
          recebimento_id: recebimento.id,
          compra_item_id: item.compra_item_id,
          produto_id: item.produto_id,
          quantidade_recebida: item.quantidade_recebida,
          quantidade_devolvida: item.quantidade_devolvida || 0,
          custo_unitario: item.custo_unitario,
          lote: item.lote || null,
          validade: item.validade || null,
          localizacao: item.localizacao || null,
          observacao: item.observacao || null,
        }));

      if (itensParaInserir.length > 0) {
        const { error: itensError } = await supabase
          .from("recebimentos_itens")
          .insert(itensParaInserir);

        if (itensError) throw itensError;
      }

      return recebimento;
    },
    onSuccess: async (recebimento, variables) => {
      // Atualizar status da compra automaticamente baseado no recebimento
      try {
        // Buscar compra atualizada
        const { data: compra } = await supabase
          .from("compras")
          .select(`*, itens:compras_itens(*)`)
          .eq("id", variables.compra_id)
          .single();
        
        if (compra) {
          const totalPedido = compra.itens.reduce((sum: number, i: any) => sum + Number(i.quantidade), 0);
          const totalRecebido = compra.itens.reduce((sum: number, i: any) => sum + Number(i.quantidade_recebida), 0);
          
          // Determinar novo status
          let novoStatus: StatusCompra = compra.status as StatusCompra;
          if (totalRecebido >= totalPedido) {
            novoStatus = 'concluido';
          } else if (totalRecebido > 0) {
            novoStatus = 'parcial';
          }
          
          // Atualizar status se mudou
          if (novoStatus !== compra.status) {
            await supabase
              .from("compras")
              .update({ status: novoStatus })
              .eq("id", variables.compra_id);
          }
        }
      } catch (err) {
        console.error("Erro ao atualizar status após recebimento:", err);
      }
      
      toast.success("Recebimento registrado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      queryClient.invalidateQueries({ queryKey: ["compras"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar recebimento:", error);
      toast.error(`Erro ao registrar recebimento: ${error.message}`);
    },
  });

  return {
    recebimentos,
    isLoading,
    registrarRecebimento,
  };
}
