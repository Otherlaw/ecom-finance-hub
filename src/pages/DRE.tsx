import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dreData, monthlyHistory, formatCurrency } from "@/lib/mock-data";
import { FileText, Download, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DRELineProps {
  label: string;
  value: number;
  indent?: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  showVariation?: boolean;
  variation?: number;
}

function DRELine({ label, value, indent = 0, isTotal = false, isSubtotal = false, showVariation = false, variation = 0 }: DRELineProps) {
  const isNegative = value < 0;
  
  return (
    <TableRow className={isTotal ? "bg-primary/5 font-bold" : isSubtotal ? "bg-secondary/50 font-semibold" : ""}>
      <TableCell className="py-3" style={{ paddingLeft: `${16 + indent * 24}px` }}>
        {label}
      </TableCell>
      <TableCell className={`text-right py-3 ${isNegative ? "text-destructive" : ""}`}>
        {formatCurrency(value)}
      </TableCell>
      <TableCell className="text-right py-3 text-muted-foreground">
        {Math.abs((value / dreData.receitaBruta) * 100).toFixed(1)}%
      </TableCell>
      {showVariation && (
        <TableCell className="text-right py-3">
          <div className={`flex items-center justify-end gap-1 ${variation >= 0 ? "text-success" : "text-destructive"}`}>
            {variation > 0 ? <TrendingUp className="h-4 w-4" /> : variation < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            <span>{variation >= 0 ? "+" : ""}{variation.toFixed(1)}%</span>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

export default function DRE() {
  return (
    <MainLayout
      title="DRE - Demonstração do Resultado"
      subtitle="Demonstrativo de resultados do exercício"
      actions={
        <div className="flex items-center gap-2">
          <Select defaultValue="outubro">
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outubro">Outubro 2024</SelectItem>
              <SelectItem value="setembro">Setembro 2024</SelectItem>
              <SelectItem value="agosto">Agosto 2024</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DRE Principal */}
        <ModuleCard
          title="DRE Consolidado"
          description="Outubro 2024"
          icon={FileText}
          className="lg:col-span-2"
          noPadding
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="w-[40%]">Descrição</TableHead>
                <TableHead className="text-right w-[25%]">Valor</TableHead>
                <TableHead className="text-right w-[15%]">% Receita</TableHead>
                <TableHead className="text-right w-[20%]">Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <DRELine label="Receita Bruta" value={dreData.receitaBruta} isSubtotal showVariation variation={-8.5} />
              <DRELine label="(-) Devoluções" value={-dreData.devolucoes} indent={1} showVariation variation={12.3} />
              <DRELine label="(-) Descontos Comerciais" value={-dreData.descontosComerciais} indent={1} showVariation variation={5.2} />
              <DRELine label="(-) Impostos sobre Vendas" value={-dreData.impostosSobreVendas} indent={1} showVariation variation={-3.1} />
              
              <DRELine label="= Receita Líquida" value={dreData.receitaLiquida} isSubtotal showVariation variation={-10.2} />
              
              <DRELine label="(-) CMV" value={-dreData.custos} indent={1} showVariation variation={8.4} />
              
              <DRELine label="= Lucro Bruto" value={dreData.lucroBruto} isSubtotal showVariation variation={-15.8} />
              
              <DRELine label="(-) Despesas Operacionais" value={-dreData.despesas} indent={1} showVariation variation={22.1} />
              
              <DRELine label="= EBITDA" value={dreData.ebitda} isSubtotal showVariation variation={-165.2} />
              
              <DRELine label="(-) Depreciação e Amortização" value={0} indent={1} showVariation variation={0} />
              
              <DRELine label="= EBIT (LAJIR)" value={dreData.ebitda} isSubtotal showVariation variation={-165.2} />
              
              <DRELine label="(+) Receitas Financeiras" value={0} indent={1} />
              <DRELine label="(-) Despesas Financeiras" value={0} indent={1} />
              
              <DRELine label="= Lucro Antes IR (LAIR)" value={dreData.lucroLiquido} isSubtotal showVariation variation={-165.2} />
              
              <DRELine label="(-) IR e CSLL" value={0} indent={1} />
              
              <DRELine label="= LUCRO LÍQUIDO" value={dreData.lucroLiquido} isTotal showVariation variation={-165.2} />
            </TableBody>
          </Table>
        </ModuleCard>

        {/* Resumo e Análise */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold">Resultado Negativo</h3>
                <p className="text-sm text-muted-foreground">Prejuízo no período</p>
              </div>
            </div>
            <div className="text-3xl font-bold text-destructive">
              {formatCurrency(dreData.lucroLiquido)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Margem líquida de {((dreData.lucroLiquido / dreData.receitaBruta) * 100).toFixed(1)}%
            </p>
          </div>

          {/* Quick Stats */}
          <ModuleCard title="Indicadores Chave">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Margem Bruta</span>
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  {((dreData.lucroBruto / dreData.receitaBruta) * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Margem Operacional</span>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  {((dreData.ebitda / dreData.receitaBruta) * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Margem Líquida</span>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  {((dreData.lucroLiquido / dreData.receitaBruta) * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">CMV / Receita</span>
                <Badge variant="outline">
                  {((dreData.custos / dreData.receitaBruta) * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Despesas / Receita</span>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  {((dreData.despesas / dreData.receitaBruta) * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>
          </ModuleCard>

          {/* Actions */}
          <div className="space-y-2">
            <Button className="w-full justify-between" variant="outline">
              Comparar com mês anterior
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button className="w-full justify-between" variant="outline">
              Ver DRE por operação
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button className="w-full justify-between" variant="outline">
              Análise vertical/horizontal
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
