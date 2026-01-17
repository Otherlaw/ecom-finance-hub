import { useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/MainLayout";
import { useVendasPaginadas, TransacaoPaginada } from "@/hooks/useVendasPaginadas";
import { useVendasPendentes } from "@/hooks/useVendasPendentes";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { useMarketplaceAutoCategorizacao } from "@/hooks/useMarketplaceAutoCategorizacao";
import { VendasDashboard } from "@/components/vendas/VendasDashboard";
import { VendasConsistencia } from "@/components/vendas/VendasConsistencia";
import { VendasTablePaginada } from "@/components/vendas/VendasTablePaginada";
import { VendasProductMappingModal } from "@/components/vendas/VendasProductMappingModal";
import { VendasCategorizacaoModal } from "@/components/vendas/VendasCategorizacaoModal";
import { PeriodFilter, PeriodOption, DateRange, getDateRangeForPeriod } from "@/components/PeriodFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShoppingBag, AlertTriangle, Link2, RefreshCw, RotateCcw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VendaItem } from "@/hooks/useVendaItens";

export default function Vendas() {
  // Estados do filtro de período
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("7days");
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeForPeriod("7days"));

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);

  // Estados de filtros simples
  const [canal, setCanal] = useState<string>("todos");
  const [conta, setConta] = useState<string>("");
  const [statusVenda, setStatusVenda] = useState<string>("todos");
  const [considerarFreteComprador, setConsiderarFreteComprador] = useState(true);

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [skuParaMapear, setSkuParaMapear] = useState<string | null>(null);
  
  // Estado para modal de categorização
  const [showCategorizacaoModal, setShowCategorizacaoModal] = useState(false);
  const [vendaParaCategorizar, setVendaParaCategorizar] = useState<TransacaoPaginada | null>(null);

  const { empresaAtiva } = useEmpresaAtiva();
  const empresaId = empresaAtiva?.id;

  // Hook paginado otimizado
  const { 
    transacoes, 
    totalRegistros,
    totalPaginas,
    resumoAgregado,
    canaisDisponiveis, 
    contasDisponiveis,
    isLoading,
    isFetching,
    dataUpdatedAt,
  } = useVendasPaginadas({
    page: currentPage,
    pageSize,
    periodoInicio: format(dateRange.from, "yyyy-MM-dd"),
    periodoFim: format(dateRange.to, "yyyy-MM-dd"),
    canal: canal !== "todos" ? canal : undefined,
    conta: conta || undefined,
    statusVenda: statusVenda !== "todos" ? statusVenda : undefined,
  });

  // Combina loading inicial + refetch (mudança de período)
  const carregando = isLoading;

  const { resumo: resumoPendentes, reprocessarMapeamentos } = useVendasPendentes({ empresaId });

  // Hook de categorização automática
  const { reprocessarAntigas, isProcessing: isAutoCategorizando } = useMarketplaceAutoCategorizacao();

  // Handler para categorização automática
  const handleCategorizarAutomatico = async () => {
    if (!empresaId) {
      toast.error("Nenhuma empresa selecionada");
      return;
    }
    
    try {
      await reprocessarAntigas.mutateAsync({ empresaId });
    } catch (error) {
      console.error("Erro na categorização automática:", error);
    }
  };

  // Handler para mudança de período
  const handlePeriodChange = (period: PeriodOption, range: DateRange) => {
    setSelectedPeriod(period);
    setDateRange(range);
    setCurrentPage(0); // Reset para primeira página ao mudar período
  };

  const handleReprocessarMapeamentos = async () => {
    if (!empresaId) {
      toast.error("Nenhuma empresa selecionada");
      return;
    }
    await reprocessarMapeamentos.mutateAsync(empresaId);
  };

  // Estado e handler para reprocessar vendas incompletas (taxas/frete zerados)
  const [reprocessando, setReprocessando] = useState(false);
  
  const handleReprocessarIncompletas = async () => {
    if (!empresaId) {
      toast.error("Nenhuma empresa selecionada");
      return;
    }
    
    setReprocessando(true);
    try {
      const { data, error } = await supabase.functions.invoke("ml-sync-orders", {
        body: { empresa_id: empresaId, days_back: 7 },
      });
      
      // Extrair mensagem de erro da resposta (quando status não é 2xx)
      if (error) {
        let mensagemErro = "Erro ao reprocessar vendas";
        
        // Tentar extrair mensagem do corpo da resposta
        try {
          const errorBody = error.context?.body ? JSON.parse(error.context.body) : null;
          if (errorBody?.error) {
            mensagemErro = errorBody.error;
          }
        } catch {
          // Fallback para mensagem padrão
        }
        
        // Verificar se é erro de integração não configurada
        if (mensagemErro.includes("integração") || mensagemErro.includes("Integrações")) {
          toast.error(mensagemErro, {
            duration: 8000,
            action: {
              label: "Ir para Integrações",
              onClick: () => window.location.href = "/integracoes"
            }
          });
        } else {
          toast.error(mensagemErro);
        }
        return;
      }
      
      // Verificar se a resposta contém erro (para outros casos)
      if (data?.error) {
        toast.error(data.error, {
          duration: 8000,
          action: {
            label: "Ir para Integrações",
            onClick: () => window.location.href = "/integracoes"
          }
        });
        return;
      }
      
      toast.success(
        `Sincronização concluída: ${data.registros_criados} novos, ${data.registros_atualizados} atualizados${data.partial ? " (parcial)" : ""}`
      );
    } catch (err) {
      console.error("Erro ao reprocessar:", err);
      const mensagem = err instanceof Error ? err.message : "Erro ao reprocessar vendas";
      toast.error(mensagem);
    } finally {
      setReprocessando(false);
    }
  };

  const handleAbrirMapeamentoLinha = (transacao: TransacaoPaginada, item?: VendaItem) => {
    setSkuParaMapear(item?.sku_marketplace || null);
    setShowMappingModal(true);
  };

  // Handler para abrir modal de categorização (usado pela tabela)
  const handleAbrirCategorizacao = (transacao: TransacaoPaginada) => {
    setVendaParaCategorizar(transacao);
    setShowCategorizacaoModal(true);
  };

  // Handler wrapper para o botão conciliar na tabela
  const handleConciliarWrapper = async (transacaoId: string): Promise<boolean> => {
    const transacao = transacoes.find(t => t.id === transacaoId);
    if (transacao) {
      handleAbrirCategorizacao(transacao);
    }
    return false; // Retorna false para não fechar automaticamente, o modal vai cuidar disso
  };

  // Adaptar resumo para o componente VendasDashboard
  const resumoAdaptado = {
    totalFaturamentoBruto: resumoAgregado?.total_bruto || 0,
    totalFaturamentoLiquido: resumoAgregado?.total_liquido || 0,
    totalCMV: 0, // CMV não vem do resumo agregado
    totalTarifas: resumoAgregado?.total_tarifas || 0,
    totalTaxas: resumoAgregado?.total_taxas || 0,
    totalOutrosDescontos: 0,
    totalFreteComprador: resumoAgregado?.total_frete_comprador || 0,
    totalFreteVendedor: resumoAgregado?.total_frete_vendedor || 0,
    totalCustoAds: resumoAgregado?.total_custo_ads || 0,
    totalImpostoVenda: 0, // Calculado pelo dashboard
    margemContribuicao: 0, // Calculado pelo dashboard
    margemContribuicaoPercent: 0, // Calculado pelo dashboard
    ticketMedio: resumoAgregado?.total_transacoes 
      ? (resumoAgregado.total_bruto || 0) / resumoAgregado.total_transacoes 
      : 0,
    qtdTransacoes: resumoAgregado?.total_transacoes || 0,
    qtdItens: 0, // Não temos esse dado no resumo agregado
  };

  // Adaptar consistência
  const consistenciaAdaptada = {
    totalNaoConciliadas: resumoAgregado?.transacoes_nao_conciliadas || 0,
    totalSemCusto: 0, // Não temos esse dado no resumo agregado atual
    totalSemProduto: 0, // Não temos esse dado no resumo agregado atual
    totalSemCategoria: resumoAgregado?.transacoes_sem_categoria || 0,
  };

  // Alíquota de imposto (poderia vir de configurações da empresa)
  const aliquotaImposto = 6;

  return (
    <MainLayout 
      title="Vendas"
      actions={
        <PeriodFilter
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          isLoading={carregando || isFetching}
        />
      }
    >
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShoppingBag className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vendas</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                Análise operacional de vendas e validação de dados da API
                <span className="text-xs">•</span>
                <span className="text-xs">
                  Atualiza automaticamente
                  {dataUpdatedAt && ` • Última: ${format(new Date(dataUpdatedAt), "HH:mm:ss")}`}
                </span>
              </p>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-2">
            {empresaId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReprocessarIncompletas}
                  disabled={reprocessando}
                >
                  {reprocessando ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Ressincronizar ML
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReprocessarMapeamentos}
                  disabled={reprocessarMapeamentos.isPending}
                >
                  {reprocessarMapeamentos.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reprocessar Mapeamentos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCategorizarAutomatico}
                  disabled={isAutoCategorizando || consistenciaAdaptada.totalNaoConciliadas === 0}
                  className="gap-2 border-primary text-primary hover:bg-primary/10"
                >
                  {isAutoCategorizando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {isAutoCategorizando ? "Categorizando..." : "Categorizar Automaticamente"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Alerta de SKUs pendentes */}
        {resumoPendentes.totalSkusPendentes > 0 && (
          <Alert variant="destructive" className="bg-warning/10 border-warning text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-semibold">
              {resumoPendentes.totalSkusPendentes} SKUs pendentes de mapeamento
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                {resumoPendentes.totalVendasAfetadas} vendas sem CMV calculado
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowMappingModal(true)}
                className="ml-4"
              >
                <Link2 className="h-4 w-4 mr-1" />
                Mapear Agora
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {carregando ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Dashboard de métricas */}
            <VendasDashboard
              resumo={resumoAdaptado}
              vendas={[]} // Não precisamos passar vendas, usamos resumo agregado
              aliquotaImposto={aliquotaImposto}
              considerarFreteComprador={considerarFreteComprador}
              onConsiderarFreteChange={setConsiderarFreteComprador}
            />

            {/* Bloco de consistência da API */}
            <VendasConsistencia 
              consistencia={consistenciaAdaptada} 
              onItemClick={() => {}}
              filtrosAtivos={{
                semCusto: false,
                semProduto: false,
                naoConciliadas: false,
              }}
              onLimparFiltros={() => {}}
            />

            {/* Tabela de vendas paginada */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Vendas do período</CardTitle>
                    <CardDescription>
                      {totalRegistros} registros encontrados • Página {currentPage + 1} de {totalPaginas || 1}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <VendasTablePaginada 
                  transacoes={transacoes} 
                  aliquotaImposto={aliquotaImposto}
                  currentPage={currentPage}
                  totalPaginas={totalPaginas}
                  totalRegistros={totalRegistros}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onConciliar={handleConciliarWrapper}
                  onAbrirMapeamento={handleAbrirMapeamentoLinha}
                  isLoading={isFetching}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Modal de mapeamento */}
      {empresaId && (
        <VendasProductMappingModal
          open={showMappingModal}
          onOpenChange={setShowMappingModal}
          empresaId={empresaId}
        />
      )}

      {/* Modal de categorização */}
      {empresaId && vendaParaCategorizar && (
        <VendasCategorizacaoModal
          open={showCategorizacaoModal}
          onOpenChange={setShowCategorizacaoModal}
          venda={{
            transacao_id: vendaParaCategorizar.id,
            canal: vendaParaCategorizar.canal,
            conta: vendaParaCategorizar.conta_nome || "",
            pedido_id: vendaParaCategorizar.pedido_id || "",
            data: vendaParaCategorizar.data_transacao,
            descricao: vendaParaCategorizar.descricao,
            valor_bruto: vendaParaCategorizar.valor_bruto,
            valor_liquido: vendaParaCategorizar.valor_liquido,
            status: vendaParaCategorizar.status,
            categoria_id: vendaParaCategorizar.categoria_id,
            centro_custo_id: vendaParaCategorizar.centro_custo_id,
          }}
          empresaId={empresaId}
          onSuccess={() => {
            setShowCategorizacaoModal(false);
            setVendaParaCategorizar(null);
          }}
        />
      )}
    </MainLayout>
  );
}
