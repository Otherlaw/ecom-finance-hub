import { useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/MainLayout";
import { useVendas, VendasFiltros } from "@/hooks/useVendas";
import { useVendasPendentes } from "@/hooks/useVendasPendentes";
import { useEmpresas } from "@/hooks/useEmpresas";
import { VendasCards } from "@/components/vendas/VendasCards";
import { VendasConsistencia } from "@/components/vendas/VendasConsistencia";
import { VendasFiltrosPanel } from "@/components/vendas/VendasFiltrosPanel";
import { VendasTable } from "@/components/vendas/VendasTable";
import { VendasProductMappingModal } from "@/components/vendas/VendasProductMappingModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShoppingBag, AlertTriangle, Link2 } from "lucide-react";

export default function Vendas() {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const inicioMes = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

  const [filtros, setFiltros] = useState<VendasFiltros>({
    dataInicio: inicioMes,
    dataFim: hoje,
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

  const { empresas } = useEmpresas();
  const empresaId = empresas?.[0]?.id;

  const { 
    vendas, 
    resumo, 
    consistencia, 
    canaisDisponiveis, 
    contasDisponiveis,
    aliquotaImposto,
    isLoading 
  } = useVendas(filtros);

  const { resumo: resumoPendentes } = useVendasPendentes({ empresaId });

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

  return (
    <MainLayout title="Vendas">
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
            {/* Cards de métricas */}
            <VendasCards resumo={resumo} aliquotaImposto={aliquotaImposto} />

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
                <VendasTable vendas={vendas} aliquotaImposto={aliquotaImposto} />
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
