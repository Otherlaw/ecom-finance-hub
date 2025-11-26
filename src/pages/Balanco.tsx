import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { balanceSheet, formatCurrency } from "@/lib/mock-data";
import { Scale, Download, Building, Wallet, Landmark, TrendingUp, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export default function Balanco() {
  // Calcular totais
  const totalAtivoCirculante = Object.values(balanceSheet.ativo.circulante).reduce((a, b) => a + b, 0);
  const totalAtivoNaoCirculante = Object.values(balanceSheet.ativo.naoCirculante).reduce((a, b) => a + b, 0);
  const totalAtivo = totalAtivoCirculante + totalAtivoNaoCirculante;

  const totalPassivoCirculante = Object.values(balanceSheet.passivo.circulante).reduce((a, b) => a + b, 0);
  const totalPassivoNaoCirculante = Object.values(balanceSheet.passivo.naoCirculante).reduce((a, b) => a + b, 0);
  const totalPassivo = totalPassivoCirculante + totalPassivoNaoCirculante;

  const totalPL = Object.values(balanceSheet.patrimonioLiquido).reduce((a, b) => a + b, 0);

  return (
    <MainLayout
      title="Balanço Patrimonial"
      subtitle="Posição patrimonial da empresa"
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
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      }
    >
      {/* Resumo Visual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="p-6 rounded-xl bg-info/5 border border-info/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-info/10">
              <Building className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total do Ativo</p>
              <p className="text-2xl font-bold">{formatCurrency(totalAtivo)}</p>
            </div>
          </div>
          <Progress value={100} className="h-2 bg-info/20" />
        </div>

        <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <Wallet className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total do Passivo</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPassivo)}</p>
            </div>
          </div>
          <Progress value={(totalPassivo / totalAtivo) * 100} className="h-2 bg-destructive/20" />
        </div>

        <div className="p-6 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-success/10">
              <Landmark className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Patrimônio Líquido</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPL)}</p>
            </div>
          </div>
          <Progress value={(totalPL / totalAtivo) * 100} className="h-2 bg-success/20" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ATIVO */}
        <ModuleCard
          title="ATIVO"
          description={`Total: ${formatCurrency(totalAtivo)}`}
          icon={Building}
        >
          <div className="space-y-6">
            {/* Ativo Circulante */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-info">Ativo Circulante</h4>
                <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                  {formatCurrency(totalAtivoCirculante)}
                </Badge>
              </div>
              <div className="space-y-3 pl-4 border-l-2 border-info/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Caixa e Equivalentes</span>
                  <span className="font-medium">{formatCurrency(balanceSheet.ativo.circulante.caixa)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estoque</span>
                  <span className="font-medium">{formatCurrency(balanceSheet.ativo.circulante.estoque)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contas a Receber</span>
                  <span className="font-medium">{formatCurrency(balanceSheet.ativo.circulante.contasReceber)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Créditos a Recuperar</span>
                  <span className="font-medium">{formatCurrency(balanceSheet.ativo.circulante.creditosRecuperar)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Crédito de ICMS</span>
                  <span className="font-medium">{formatCurrency(balanceSheet.ativo.circulante.creditoIcms)}</span>
                </div>
              </div>
            </div>

            {/* Ativo Não Circulante */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-info/70">Ativo Não Circulante</h4>
                <Badge variant="outline">
                  {formatCurrency(totalAtivoNaoCirculante)}
                </Badge>
              </div>
              <div className="space-y-3 pl-4 border-l-2 border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Investimentos</span>
                  <span className="font-medium">{formatCurrency(balanceSheet.ativo.naoCirculante.investimentos)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Imobilizado</span>
                  <span className="font-medium">{formatCurrency(balanceSheet.ativo.naoCirculante.imobilizado)}</span>
                </div>
              </div>
            </div>
          </div>
        </ModuleCard>

        {/* PASSIVO + PL */}
        <div className="space-y-6">
          {/* PASSIVO */}
          <ModuleCard
            title="PASSIVO"
            description={`Total: ${formatCurrency(totalPassivo)}`}
            icon={Wallet}
          >
            <div className="space-y-6">
              {/* Passivo Circulante */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-destructive">Passivo Circulante</h4>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    {formatCurrency(totalPassivoCirculante)}
                  </Badge>
                </div>
                <div className="space-y-3 pl-4 border-l-2 border-destructive/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fornecedores</span>
                    <span className="font-medium">{formatCurrency(balanceSheet.passivo.circulante.fornecedores)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Obrigações Fiscais</span>
                    <span className="font-medium">{formatCurrency(balanceSheet.passivo.circulante.obrigacoesFiscais)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Obrigações Trabalhistas</span>
                    <span className="font-medium">{formatCurrency(balanceSheet.passivo.circulante.obrigacoesTrabalhistas)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Contas a Pagar</span>
                    <span className="font-medium">{formatCurrency(balanceSheet.passivo.circulante.contasPagar)}</span>
                  </div>
                </div>
              </div>
            </div>
          </ModuleCard>

          {/* PATRIMÔNIO LÍQUIDO */}
          <ModuleCard
            title="PATRIMÔNIO LÍQUIDO"
            description={`Total: ${formatCurrency(totalPL)}`}
            icon={Landmark}
          >
            <div className="space-y-3 pl-4 border-l-2 border-success/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Capital Social</span>
                <span className="font-medium">{formatCurrency(balanceSheet.patrimonioLiquido.capitalSocial)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reservas</span>
                <span className="font-medium">{formatCurrency(balanceSheet.patrimonioLiquido.reservas)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lucros Acumulados</span>
                <span className="font-medium">{formatCurrency(balanceSheet.patrimonioLiquido.lucrosAcumulados)}</span>
              </div>
            </div>
          </ModuleCard>
        </div>
      </div>

      {/* Indicadores */}
      <div className="mt-6">
        <ModuleCard title="Indicadores Patrimoniais" icon={TrendingUp}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-1">Liquidez Corrente</p>
              <p className="text-2xl font-bold text-info">
                {(totalAtivoCirculante / totalPassivoCirculante).toFixed(2)}
              </p>
              <Badge className="mt-2 bg-success/10 text-success">Saudável</Badge>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-1">Endividamento</p>
              <p className="text-2xl font-bold">
                {((totalPassivo / totalAtivo) * 100).toFixed(1)}%
              </p>
              <Badge className="mt-2 bg-success/10 text-success">Baixo</Badge>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-1">Composição PL</p>
              <p className="text-2xl font-bold">
                {((totalPL / totalAtivo) * 100).toFixed(1)}%
              </p>
              <Badge className="mt-2 bg-success/10 text-success">Forte</Badge>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-1">Capital de Giro</p>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(totalAtivoCirculante - totalPassivoCirculante)}
              </p>
              <Badge className="mt-2 bg-success/10 text-success">Positivo</Badge>
            </div>
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
