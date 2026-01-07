/**
 * Hook para sincronização do Motor de Entrada Unificada (MEU)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  sincronizarTodosMovimentos, 
  contarPendentesSincronizacao,
  SincronizacaoResultado 
} from "@/lib/sincronizar-movimentos";
import { FLUXO_CAIXA_KEY_PREFIX } from "@/lib/queryKeys";

export function useSincronizacaoMEU() {
  const queryClient = useQueryClient();

  // Query para verificar pendências
  const { data: pendentes, isLoading: isLoadingPendentes, refetch: refetchPendentes } = useQuery({
    queryKey: ["sincronizacao-meu-pendentes"],
    queryFn: contarPendentesSincronizacao,
    staleTime: 30000, // 30 segundos
  });

  // Mutation para sincronizar
  const sincronizar = useMutation({
    mutationFn: sincronizarTodosMovimentos,
    onSuccess: (resultado: SincronizacaoResultado) => {
      const total = resultado.contasPagarSincronizadas + 
                   resultado.contasReceberSincronizadas + 
                   resultado.marketplaceSincronizados;

      if (total > 0) {
        toast.success(`${total} movimentos sincronizados com sucesso!`);
      } else {
        toast.info("Todos os dados já estão sincronizados");
      }

      if (resultado.erros.length > 0) {
        toast.warning(`${resultado.erros.length} erros durante sincronização`);
      }

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["dre-movimentos-meu"] });
      queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX });
      queryClient.invalidateQueries({ queryKey: ["sincronizacao-meu-pendentes"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  const totalPendentes = pendentes 
    ? pendentes.contasPagar + pendentes.contasReceber + pendentes.marketplace 
    : 0;

  const temPendencias = totalPendentes > 0;

  return {
    pendentes,
    totalPendentes,
    temPendencias,
    isLoadingPendentes,
    refetchPendentes,
    sincronizar,
    isSincronizando: sincronizar.isPending,
  };
}
