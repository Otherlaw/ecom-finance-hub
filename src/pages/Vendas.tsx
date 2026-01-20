import { useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/MainLayout";
import { useVendasPorPedido, PedidoAgregado, ResumoPedidosAgregado } from "@/hooks/useVendasPorPedido";
import { useVendasPaginadas } from "@/hooks/useVendasPaginadas";
import { useVendasPendentes } from "@/hooks/useVendasPendentes";
import { useMarketplaceAutoCategorizacao } from "@/hooks/useMarketplaceAutoCategorizacao";
import { VendasDashboard } from "@/components/vendas/VendasDashboard";
import { VendasConsistencia } from "@/components/vendas/VendasConsistencia";
import { PedidosTable } from "@/components/vendas/PedidosTable";
import { VendasProductMappingModal } from "@/components/vendas/VendasProductMappingModal";
import { PeriodFilter, PeriodOption, DateRange, getDateRangeForPeriod } from "@/components/PeriodFilter";
import { EmpresaFilter } from "@/components/EmpresaFilter";
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
  const [empresaSelecionada, setEmpresaSelecionada] = useState("todas");

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

  // ID da empresa para filtros (undefined = todas)
  const empresaId = empresaSelecionada !== "todas" ? empresaSelecionada : undefined;

  // Hook de vendas por pedido (agregado - 1 linha por pedido)
  const {
    pedidos,
    totalRegistros,
    totalPaginas,
    resumoAgregado,
    canaisDisponiveis,
    contasDisponiveis,
    isLoading,
    isFetching,
    dataUpdatedAt,
  } = useVendasPorPedido({
    page: currentPage,
    pageSize,
    periodoInicio: format(dateRange.from, "yyyy-MM-dd"),
    periodoFim: format(dateRange.to, "yyyy-MM-dd"),
    canal: canal !== "todos" ? canal : undefined,
    conta: conta || undefined,
    statusVenda: statusVenda !== "todos" ? statusVenda : undefined,
    empresaId,
  });

  // Hook antigo apenas para métricas por tipo de envio (dashboard)
  const { metricasPorTipoEnvio } = useVendasPaginadas({
    page: 0,
    pageSize: 1,
    periodoInicio: format(dateRange.from, "yyyy-MM-dd"),
    periodoFim: format(dateRange.to, "yyyy-MM-dd"),
    empresaId,
  });

  // Combina loading inicial + refetch
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
    setCurrentPage(0);
  };

  const handleReprocessarMapeamentos = async () => {
    if (!empresaId) {
      toast.error("Nenhuma empresa selecionada");
      return;
    }
    await reprocessarMapeamentos.mutateAsync(empresaId);
  };

  // Estado e handler para reprocessar vendas incompletas
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

      if (error) {
        let mensagemErro = "Erro ao reprocessar vendas";

        try {
          const errorBody = error.context?.body ? JSON.parse(error.context.body) : null;
          if (errorBody?.error) {
            mensagemErro = errorBody.error;
          }
        } catch {
          // Fallback
        }

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

  const handleAbrirMapeamentoLinha = (pedido: PedidoAgregado, item?: VendaItem) => {
    setSkuParaMapear(item?.sku_marketplace || null);
    setShowMappingModal(true);
  };

  // Alíquota de imposto (poderia vir de configurações da empresa)
  const aliquotaImposto = 6;

  // Adaptar resumo para o componente VendasDashboard
  const resumoAdaptado = resumoAgregado ? {
    totalFaturamentoBruto: resumoAgregado.valor_produto_total,
    totalFaturamentoLiquido: resumoAgregado.valor_liquido_total,
    totalCMV: resumoAgregado.cmv_total,
    totalTarifas: resumoAgregado.tarifa_fixa_total,
    totalTaxas: resumoAgregado.comissao_total,
    totalOutrosDescontos: 0,
    totalFreteComprador: 0, // Não incluído na agregação por pedido
    totalFreteVendedor: resumoAgregado.frete_vendedor_total,
    totalCustoAds: resumoAgregado.ads_total,
    totalImpostoVenda: resumoAgregado.impostos_total,
    margemContribuicao: resumoAgregado.margem_contribuicao_total,
    margemContribuicaoPercent: resumoAgregado.valor_produto_total > 0
      ? (resumoAgregado.margem_contribuicao_total / resumoAgregado.valor_produto_total) * 100
      : 0,
    ticketMedio: resumoAgregado.total_pedidos > 0
      ? resumoAgregado.valor_produto_total / resumoAgregado.total_pedidos
      : 0,
    qtdTransacoes: resumoAgregado.total_pedidos,
    qtdItens: resumoAgregado.total_itens,
  } : {
    totalFaturamentoBruto: 0,
    totalFaturamentoLiquido: 0,
    totalCMV: 0,
    totalTarifas: 0,
    totalTaxas: 0,
    totalOutrosDescontos: 0,
    totalFreteComprador: 0,
    totalFreteVendedor: 0,
    totalCustoAds: 0,
    totalImpostoVenda: 0,
    margemContribuicao: 0,
    margemContribuicaoPercent: 0,
    ticketMedio: 0,
    qtdTransacoes: 0,
    qtdItens: 0,
  };

  // Adaptar consistência (valores não disponíveis na agregação por pedido)
  const consistenciaAdaptada = {
    totalNaoConciliadas: 0,
    totalSemCusto: 0,
    totalSemProduto: 0,
    totalSemCategoria: 0,
  };

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
        {/* Filtro de empresa */}
        <div className="flex items-center gap-4">
          <EmpresaFilter
            value={empresaSelecionada}
            onChange={(val) => {
              setEmpresaSelecionada(val);
              setCurrentPage(0);
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShoppingBag className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vendas por Pedido</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                1 linha por pedido • Custos consolidados
                <span className="text-xs">•</span>
                <span className="text-xs">
                  {dataUpdatedAt && `Atualizado: ${format(new Date(dataUpdatedAt), "HH:mm:ss")}`}
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
              metricasPorTipo={metricasPorTipoEnvio}
              aliquotaImposto={aliquotaImposto}
              considerarFreteComprador={considerarFreteComprador}
              onConsiderarFreteChange={setConsiderarFreteComprador}
            />

            {/* Tabela de pedidos (1 linha por pedido) */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Pedidos do período</CardTitle>
                    <CardDescription>
                      {totalRegistros} pedidos • Página {currentPage + 1} de {totalPaginas || 1}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <PedidosTable
                  pedidos={pedidos}
                  currentPage={currentPage}
                  totalPaginas={totalPaginas}
                  totalRegistros={totalRegistros}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
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
    </MainLayout>
  );
}
