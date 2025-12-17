import { useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/MainLayout";
import { useVendas, VendasFiltros } from "@/hooks/useVendas";
import { useVendasPendentes } from "@/hooks/useVendasPendentes";
import { useEmpresas } from "@/hooks/useEmpresas";
import { VendasDashboard } from "@/components/vendas/VendasDashboard";
import { VendasConsistencia } from "@/components/vendas/VendasConsistencia";
import { VendasFiltrosPanel } from "@/components/vendas/VendasFiltrosPanel";
import { VendasTable } from "@/components/vendas/VendasTable";
import { VendasProductMappingModal } from "@/components/vendas/VendasProductMappingModal";
import { VendasCategorizacaoModal } from "@/components/vendas/VendasCategorizacaoModal";
import { PeriodFilter, PeriodOption, DateRange, getDateRangeForPeriod } from "@/components/PeriodFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShoppingBag, AlertTriangle, Link2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Vendas() {
  // Estados do filtro de período
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("30days");
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeForPeriod("30days"));

  const [filtros, setFiltros] = useState<VendasFiltros>({
    dataInicio: format(dateRange.from, "yyyy-MM-dd"),
    dataFim: format(dateRange.to, "yyyy-MM-dd"),
    titulo: "",
    sku: "",
    pedidoId: "",
    canal: "todos",
    conta: "",
    statusVenda: "todos",
    considerarFreteComprador: true,
    somenteComDivergencia: false,
    somenteNaoConciliadas: false,
    somenteSemCusto: false,
    somenteSemProduto: false,
  });

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [skuParaMapear, setSkuParaMapear] = useState<string | null>(null);
  
  // Estado para modal de categorização
  const [showCategorizacaoModal, setShowCategorizacaoModal] = useState(false);
  const [vendaParaCategorizar, setVendaParaCategorizar] = useState<any>(null);

  const { empresas } = useEmpresas();
  const empresaId = empresas?.[0]?.id;

  const { 
    vendas, 
    resumo, 
    consistencia, 
    canaisDisponiveis, 
    contasDisponiveis,
    aliquotaImposto,
    isLoading,
    conciliarTransacao,
  } = useVendas(filtros);

  const { resumo: resumoPendentes, reprocessarMapeamentos } = useVendasPendentes({ empresaId });

  // Handler para mudança de período
  const handlePeriodChange = (period: PeriodOption, range: DateRange) => {
    setSelectedPeriod(period);
    setDateRange(range);
    setFiltros((prev) => ({
      ...prev,
      dataInicio: format(range.from, "yyyy-MM-dd"),
      dataFim: format(range.to, "yyyy-MM-dd"),
    }));
  };

  const handleFiltroChange = (campo: keyof VendasFiltros, valor: any) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleConsistenciaClick = (tipo: string) => {
    setFiltros((prev) => ({
      ...prev,
      somenteNaoConciliadas: tipo === "naoConciliadas",
      somenteSemCusto: tipo === "semCusto",
      somenteSemProduto: tipo === "semProduto",
    }));
  };

  const limparFiltrosConsistencia = () => {
    setFiltros((prev) => ({
      ...prev,
      somenteNaoConciliadas: false,
      somenteSemCusto: false,
      somenteSemProduto: false,
    }));
  };

  const limparFiltrosEspeciais = () => {
    setFiltros((prev) => ({
      ...prev,
      somenteNaoConciliadas: false,
      somenteSemCusto: false,
      somenteSemProduto: false,
      tipoEnvio: "",
      teveAds: "todos",
    }));
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
      
      if (error) throw error;
      
      toast.success(
        `Sincronização concluída: ${data.registros_criados} novos, ${data.registros_atualizados} atualizados${data.partial ? " (parcial)" : ""}`
      );
    } catch (err) {
      console.error("Erro ao reprocessar:", err);
      toast.error("Erro ao reprocessar vendas");
    } finally {
      setReprocessando(false);
    }
  };

  const handleAbrirMapeamentoLinha = (venda: any) => {
    setSkuParaMapear(venda.sku_marketplace || venda.sku_interno || null);
    setShowMappingModal(true);
  };

  // Handler para abrir modal de categorização (usado pela tabela)
  const handleAbrirCategorizacao = (venda: any) => {
    setVendaParaCategorizar(venda);
    setShowCategorizacaoModal(true);
  };

  // Handler wrapper para o botão conciliar na tabela
  const handleConciliarWrapper = async (transacaoId: string): Promise<boolean> => {
    const venda = vendas.find(v => v.transacao_id === transacaoId);
    if (venda) {
      handleAbrirCategorizacao(venda);
    }
    return false; // Retorna false para não fechar automaticamente, o modal vai cuidar disso
  };

  return (
    <MainLayout 
      title="Vendas"
      actions={
        <PeriodFilter
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          isLoading={isLoading}
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
              <p className="text-sm text-muted-foreground">
                Análise operacional de vendas e validação de dados da API
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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Dashboard de métricas */}
            <VendasDashboard
              resumo={resumo}
              vendas={vendas}
              aliquotaImposto={aliquotaImposto}
              considerarFreteComprador={filtros.considerarFreteComprador ?? true}
              onConsiderarFreteChange={(value) => handleFiltroChange("considerarFreteComprador", value)}
            />

            {/* Bloco de consistência da API */}
            <VendasConsistencia 
              consistencia={consistencia} 
              onItemClick={handleConsistenciaClick}
              filtrosAtivos={{
                semCusto: filtros.somenteSemCusto,
                semProduto: filtros.somenteSemProduto,
                naoConciliadas: filtros.somenteNaoConciliadas,
              }}
              onLimparFiltros={limparFiltrosConsistencia}
            />

            {/* Filtros */}
            <VendasFiltrosPanel
              filtros={filtros}
              onFiltroChange={handleFiltroChange}
              canaisDisponiveis={canaisDisponiveis}
              contasDisponiveis={contasDisponiveis}
              onLimparFiltrosEspeciais={limparFiltrosEspeciais}
            />

            {/* Tabela de vendas */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Vendas do período</CardTitle>
                    <CardDescription>
                      {vendas.length} registros encontrados
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <VendasTable 
                  vendas={vendas} 
                  aliquotaImposto={aliquotaImposto}
                  onConciliar={handleConciliarWrapper}
                  onAbrirMapeamento={handleAbrirMapeamentoLinha}
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
          venda={vendaParaCategorizar}
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
