import { useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/MainLayout";
import { useVendas, VendasFiltros } from "@/hooks/useVendas";
import { VendasCards } from "@/components/vendas/VendasCards";
import { VendasConsistencia } from "@/components/vendas/VendasConsistencia";
import { VendasFiltrosPanel } from "@/components/vendas/VendasFiltrosPanel";
import { VendasTable } from "@/components/vendas/VendasTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShoppingBag } from "lucide-react";

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

  const { 
    vendas, 
    resumo, 
    consistencia, 
    canaisDisponiveis, 
    contasDisponiveis,
    aliquotaImposto,
    isLoading 
  } = useVendas(filtros);

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
                <VendasTable vendas={vendas} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
