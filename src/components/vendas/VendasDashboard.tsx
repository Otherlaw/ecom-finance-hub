/**
 * Dashboard de Vendas - Layout baseado na referência do usuário
 * Organizado por tipo de envio com métricas detalhadas
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResumoVendas } from "@/hooks/useVendas";
import { MetricasPorTipoEnvio } from "@/hooks/useVendasPaginadas";
import { cn } from "@/lib/utils";
import { Package, Truck, Percent, Calculator, ShoppingCart, RotateCcw, AlertTriangle } from "lucide-react";
interface VendasDashboardProps {
  resumo: ResumoVendas;
  metricasPorTipo: MetricasPorTipoEnvio[];
  aliquotaImposto: number;
  considerarFreteComprador: boolean;
  onConsiderarFreteChange: (value: boolean) => void;
}
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}
function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

// Transformar métricas por tipo de envio vindas da RPC em formato de lookup
function transformarMetricasPorTipo(metricas: MetricasPorTipoEnvio[]) {
  const lookup: Record<string, {
    qtd: number;
    valorBruto: number;
    valorLiquido: number;
    tarifas: number;
    cmv: number;
    freteComprador: number;
    freteVendedor: number;
    custoAds: number;
  }> = {};

  // Inicializar com valores zerados para tipos conhecidos
  ["full", "flex", "coleta", "places", "outros"].forEach(tipo => {
    lookup[tipo] = {
      qtd: 0,
      valorBruto: 0,
      valorLiquido: 0,
      tarifas: 0,
      cmv: 0,
      freteComprador: 0,
      freteVendedor: 0,
      custoAds: 0
    };
  });

  // Preencher com dados reais da RPC
  metricas.forEach(m => {
    const tipo = (m.tipo_envio || "outros").toLowerCase();
    lookup[tipo] = {
      qtd: m.qtd_itens,
      valorBruto: m.valor_bruto,
      valorLiquido: m.valor_liquido,
      tarifas: m.tarifas + m.taxas,
      cmv: m.cmv_total,
      freteComprador: m.frete_comprador,
      freteVendedor: m.frete_vendedor,
      custoAds: m.custo_ads
    };
  });
  return lookup;
}
export function VendasDashboard({
  resumo,
  metricasPorTipo,
  aliquotaImposto,
  considerarFreteComprador,
  onConsiderarFreteChange
}: VendasDashboardProps) {
  const metricasLookup = transformarMetricasPorTipo(metricasPorTipo);

  // Calcular margens considerando ou não frete do comprador
  const calcularMargem = (valorLiquido: number, cmv: number, freteVendedor: number, custoAds: number, freteComprador: number, valorBruto: number) => {
    const imposto = valorBruto * (aliquotaImposto / 100);
    let margemRs = valorLiquido - cmv - freteVendedor - custoAds - imposto;
    if (considerarFreteComprador) {
      margemRs += freteComprador;
    }
    const margemPercent = valorBruto > 0 ? margemRs / valorBruto * 100 : 0;
    return {
      margemRs,
      margemPercent
    };
  };
  const margemGeral = calcularMargem(resumo.totalFaturamentoLiquido, resumo.totalCMV, resumo.totalFreteVendedor, resumo.totalCustoAds, resumo.totalFreteComprador, resumo.totalFaturamentoBruto);

  // Frete líquido (comprador - vendedor)
  const freteLiquido = resumo.totalFreteComprador - resumo.totalFreteVendedor;
  return <div className="space-y-4">
      {/* Cards principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Vendas Aprovadas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-500" />
              Vendas Aprovadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(resumo.totalFaturamentoBruto)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {resumo.qtdTransacoes} pedidos • {resumo.qtdItens} itens
            </p>
          </CardContent>
        </Card>

        {/* Custo & Imposto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" />
              Custo & Imposto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {formatCurrency(resumo.totalCMV + resumo.totalImpostoVenda)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <p>CMV: {formatCurrency(resumo.totalCMV)}</p>
              <p>Imposto ({aliquotaImposto}%): {formatCurrency(resumo.totalImpostoVenda)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tarifa de Venda */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calculator className="h-4 w-4 text-red-500" />
              Tarifa de Venda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(resumo.totalTarifas + resumo.totalTaxas)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((resumo.totalTarifas + resumo.totalTaxas) / resumo.totalFaturamentoBruto * 100 || 0).toFixed(1)}% do faturamento
            </p>
            {resumo.totalCustoAds > 0 && <p className="text-xs text-purple-500 mt-0.5">
                + ADS: {formatCurrency(resumo.totalCustoAds)}
              </p>}
          </CardContent>
        </Card>

        {/* Frete Vendedor */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-500" />
              Frete Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(resumo.totalFreteVendedor)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Custo de envio pago por você
            </p>
          </CardContent>
        </Card>

        {/* Margem de Contribuição */}
        <Card className="ring-1 ring-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              Margem Contribuição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", margemGeral.margemRs >= 0 ? "text-emerald-500" : "text-red-500")}>
              {formatCurrency(margemGeral.margemRs)}
            </div>
            <p className={cn("text-sm font-medium mt-1", margemGeral.margemPercent >= 20 ? "text-emerald-500" : margemGeral.margemPercent >= 10 ? "text-amber-500" : "text-red-500")}>
              {formatPercent(margemGeral.margemPercent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Checkbox considerar frete */}
      

      {/* Alerta de vendas aguardando classificação */}
      {(() => {
      const totalClassificadas = metricasLookup["full"].qtd + metricasLookup["flex"].qtd + metricasLookup["coleta"].qtd + metricasLookup["places"].qtd;
      const vendasSemClassificacao = resumo.qtdItens - totalClassificadas;
      if (vendasSemClassificacao > 0) {
        return <Alert className="bg-amber-500/10 border-amber-500/50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-semibold text-amber-800 dark:text-amber-200">
                {vendasSemClassificacao} itens aguardando classificação
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Vendas recentes ainda não foram classificadas por tipo de envio (Full, Flex, Coleta). 
                Isso é normal para vendas dos últimos dias. A classificação é atualizada automaticamente 
                pela integração com o Mercado Livre.
              </AlertDescription>
            </Alert>;
      }
      return null;
    })()}

      {/* Cards por tipo de envio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Full */}
        <TipoEnvioCard titulo="Full" icon={<Package className="h-4 w-4" />} metricas={metricasLookup["full"]} aliquotaImposto={aliquotaImposto} considerarFreteComprador={considerarFreteComprador} color="emerald" />

        {/* Flex */}
        <TipoEnvioCard titulo="Flex" icon={<Truck className="h-4 w-4" />} metricas={metricasLookup["flex"]} aliquotaImposto={aliquotaImposto} considerarFreteComprador={considerarFreteComprador} color="blue" />

        {/* Places/Coleta */}
        <TipoEnvioCard titulo="Places / Coleta" icon={<RotateCcw className="h-4 w-4" />} metricas={{
        qtd: (metricasLookup["places"]?.qtd || 0) + (metricasLookup["coleta"]?.qtd || 0),
        valorBruto: (metricasLookup["places"]?.valorBruto || 0) + (metricasLookup["coleta"]?.valorBruto || 0),
        valorLiquido: (metricasLookup["places"]?.valorLiquido || 0) + (metricasLookup["coleta"]?.valorLiquido || 0),
        tarifas: (metricasLookup["places"]?.tarifas || 0) + (metricasLookup["coleta"]?.tarifas || 0),
        cmv: (metricasLookup["places"]?.cmv || 0) + (metricasLookup["coleta"]?.cmv || 0),
        freteComprador: (metricasLookup["places"]?.freteComprador || 0) + (metricasLookup["coleta"]?.freteComprador || 0),
        freteVendedor: (metricasLookup["places"]?.freteVendedor || 0) + (metricasLookup["coleta"]?.freteVendedor || 0),
        custoAds: (metricasLookup["places"]?.custoAds || 0) + (metricasLookup["coleta"]?.custoAds || 0)
      }} aliquotaImposto={aliquotaImposto} considerarFreteComprador={considerarFreteComprador} color="amber" />
      </div>

      {/* Métricas adicionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniMetricaCard titulo="Ticket Médio" valor={formatCurrency(resumo.ticketMedio)} subtitulo="por pedido" />
        <MiniMetricaCard titulo="Ticket Médio MC" valor={formatCurrency(resumo.qtdTransacoes > 0 ? margemGeral.margemRs / resumo.qtdTransacoes : 0)} subtitulo="margem por pedido" />
        <MiniMetricaCard titulo="Qtd Vendas" valor={resumo.qtdTransacoes.toString()} subtitulo="pedidos aprovados" />
        <MiniMetricaCard titulo="Qtd Itens" valor={resumo.qtdItens.toString()} subtitulo="produtos vendidos" />
      </div>
    </div>;
}

// Componente para card de tipo de envio
interface TipoEnvioCardProps {
  titulo: string;
  icon: React.ReactNode;
  metricas: {
    qtd: number;
    valorBruto: number;
    valorLiquido: number;
    tarifas: number;
    cmv: number;
    freteComprador: number;
    freteVendedor: number;
    custoAds: number;
  };
  aliquotaImposto: number;
  considerarFreteComprador: boolean;
  color: "emerald" | "blue" | "amber" | "purple";
}
function TipoEnvioCard({
  titulo,
  icon,
  metricas,
  aliquotaImposto,
  considerarFreteComprador,
  color
}: TipoEnvioCardProps) {
  const colorClasses = {
    emerald: "text-emerald-500 bg-emerald-500/10",
    blue: "text-blue-500 bg-blue-500/10",
    amber: "text-amber-500 bg-amber-500/10",
    purple: "text-purple-500 bg-purple-500/10"
  };
  const imposto = metricas.valorBruto * (aliquotaImposto / 100);
  let margem = metricas.valorLiquido - metricas.cmv - metricas.freteVendedor - metricas.custoAds - imposto;
  if (considerarFreteComprador) {
    margem += metricas.freteComprador;
  }
  const margemPercent = metricas.valorBruto > 0 ? margem / metricas.valorBruto * 100 : 0;
  if (metricas.qtd === 0) {
    return <Card className="opacity-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className={cn("p-1.5 rounded", colorClasses[color])}>
              {icon}
            </div>
            {titulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sem vendas no período</p>
        </CardContent>
      </Card>;
  }
  return <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className={cn("p-1.5 rounded", colorClasses[color])}>
            {icon}
          </div>
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Vendas</span>
          <span className="font-medium">{formatCurrency(metricas.valorBruto)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Tarifas</span>
          <span className="font-medium text-red-500">-{formatCurrency(metricas.tarifas)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">CMV</span>
          <span className="font-medium text-orange-500">-{formatCurrency(metricas.cmv)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Frete Vendedor</span>
          <span className="font-medium text-red-500">
            -{formatCurrency(metricas.freteVendedor)}
          </span>
        </div>
        <div className="border-t pt-2 flex justify-between items-center">
          <span className="text-sm font-medium">Margem</span>
          <div className="text-right">
            <span className={cn("font-bold", margem >= 0 ? "text-emerald-500" : "text-red-500")}>
              {formatCurrency(margem)}
            </span>
            <span className={cn("block text-xs", margemPercent >= 20 ? "text-emerald-500" : margemPercent >= 10 ? "text-amber-500" : "text-red-500")}>
              {formatPercent(margemPercent)}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {metricas.qtd} itens vendidos
        </p>
      </CardContent>
    </Card>;
}

// Mini card de métrica
function MiniMetricaCard({
  titulo,
  valor,
  subtitulo
}: {
  titulo: string;
  valor: string;
  subtitulo: string;
}) {
  return <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="text-lg font-bold">{valor}</p>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </CardContent>
    </Card>;
}