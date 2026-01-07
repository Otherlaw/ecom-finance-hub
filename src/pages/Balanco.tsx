import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBalancoPatrimonial } from "@/hooks/useBalancoPatrimonial";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { formatCurrency } from "@/lib/mock-data";
import { Scale, Download, Building, Wallet, Landmark, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Balanco() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaId = empresaAtiva?.id;
  
  const { data: balanco, isLoading, error } = useBalancoPatrimonial(empresaId, mes, ano);

  if (isLoading) {
    return (
      <MainLayout title="Balanço Patrimonial" subtitle="Carregando dados...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error || !balanco) {
    return (
      <MainLayout title="Balanço Patrimonial" subtitle="Erro ao carregar dados">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar dados do balanço patrimonial.
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  // Calcular totais
  const totalAtivoCirculante = Object.values(balanco.ativo.circulante).reduce((a, b) => a + b, 0);
  const totalAtivoNaoCirculante = Object.values(balanco.ativo.naoCirculante).reduce((a, b) => a + b, 0);
  const totalAtivo = totalAtivoCirculante + totalAtivoNaoCirculante;

  const totalPassivoCirculante = Object.values(balanco.passivo.circulante).reduce((a, b) => a + b, 0);
  const totalPassivoNaoCirculante = balanco.passivo.naoCirculante.emprestimosLP;
  const totalPassivo = totalPassivoCirculante + totalPassivoNaoCirculante;

  const totalPL = Object.values(balanco.patrimonioLiquido).reduce((a, b) => a + b, 0);

  // Indicadores
  const liquidezCorrente = totalPassivoCirculante > 0 ? totalAtivoCirculante / totalPassivoCirculante : 0;
  const endividamento = totalAtivo > 0 ? (totalPassivo / totalAtivo) * 100 : 0;
  const composicaoPL = totalAtivo > 0 ? (totalPL / totalAtivo) * 100 : 0;
  const capitalGiro = totalAtivoCirculante - totalPassivoCirculante;

  const getIndicadorStatus = (valor: number, tipo: string) => {
    if (tipo === "liquidez") {
      if (valor >= 1.5) return { label: "Saudável", variant: "success" as const };
      if (valor >= 1) return { label: "Adequado", variant: "warning" as const };
      return { label: "Baixo", variant: "destructive" as const };
    }
    if (tipo === "endividamento") {
      if (valor <= 50) return { label: "Baixo", variant: "success" as const };
      if (valor <= 70) return { label: "Moderado", variant: "warning" as const };
      return { label: "Alto", variant: "destructive" as const };
    }
    if (tipo === "composicao") {
      if (valor >= 50) return { label: "Forte", variant: "success" as const };
      if (valor >= 30) return { label: "Moderado", variant: "warning" as const };
      return { label: "Fraco", variant: "destructive" as const };
    }
    return { label: valor >= 0 ? "Positivo" : "Negativo", variant: valor >= 0 ? "success" as const : "destructive" as const };
  };

  return (
    <MainLayout
      title="Balanço Patrimonial"
      subtitle="Posição patrimonial da empresa (dados reais do sistema)"
      actions={
        <div className="flex items-center gap-2">
          <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: "1", label: "Janeiro" },
                { value: "2", label: "Fevereiro" },
                { value: "3", label: "Março" },
                { value: "4", label: "Abril" },
                { value: "5", label: "Maio" },
                { value: "6", label: "Junho" },
                { value: "7", label: "Julho" },
                { value: "8", label: "Agosto" },
                { value: "9", label: "Setembro" },
                { value: "10", label: "Outubro" },
                { value: "11", label: "Novembro" },
                { value: "12", label: "Dezembro" },
              ].map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026].map((a) => (
                <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      }
    >
      {/* Alerta informativo */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Os valores de <strong>Capital Social</strong>, <strong>Investimentos</strong> e <strong>Imobilizado</strong> são configuráveis. 
          Os demais valores são calculados automaticamente a partir dos dados do sistema (estoque, contas a pagar/receber, créditos de ICMS).
        </AlertDescription>
      </Alert>

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
          <Progress value={totalAtivo > 0 ? (totalPassivo / totalAtivo) * 100 : 0} className="h-2 bg-destructive/20" />
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
          <Progress value={totalAtivo > 0 ? (totalPL / totalAtivo) * 100 : 0} className="h-2 bg-success/20" />
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
                  <span className="font-medium">{formatCurrency(balanco.ativo.circulante.caixa)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estoque</span>
                  <span className="font-medium">{formatCurrency(balanco.ativo.circulante.estoque)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contas a Receber</span>
                  <span className="font-medium">{formatCurrency(balanco.ativo.circulante.contasReceber)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Créditos a Recuperar</span>
                  <span className="font-medium">{formatCurrency(balanco.ativo.circulante.creditosRecuperar)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Crédito de ICMS</span>
                  <span className="font-medium">{formatCurrency(balanco.ativo.circulante.creditoIcms)}</span>
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
                  <span className="font-medium">{formatCurrency(balanco.ativo.naoCirculante.investimentos)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Imobilizado</span>
                  <span className="font-medium">{formatCurrency(balanco.ativo.naoCirculante.imobilizado)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Intangível</span>
                  <span className="font-medium">{formatCurrency(balanco.ativo.naoCirculante.intangivel)}</span>
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
                    <span className="font-medium">{formatCurrency(balanco.passivo.circulante.fornecedores)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Obrigações Fiscais</span>
                    <span className="font-medium">{formatCurrency(balanco.passivo.circulante.obrigacoesFiscais)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Obrigações Trabalhistas</span>
                    <span className="font-medium">{formatCurrency(balanco.passivo.circulante.obrigacoesTrabalhistas)}</span>
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
                <span className="font-medium">{formatCurrency(balanco.patrimonioLiquido.capitalSocial)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reservas</span>
                <span className="font-medium">{formatCurrency(balanco.patrimonioLiquido.reservas)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lucros Acumulados</span>
                <span className="font-medium">{formatCurrency(balanco.patrimonioLiquido.lucrosAcumulados)}</span>
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
                {liquidezCorrente.toFixed(2)}
              </p>
              <Badge className={`mt-2 bg-${getIndicadorStatus(liquidezCorrente, "liquidez").variant}/10 text-${getIndicadorStatus(liquidezCorrente, "liquidez").variant}`}>
                {getIndicadorStatus(liquidezCorrente, "liquidez").label}
              </Badge>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-1">Endividamento</p>
              <p className="text-2xl font-bold">
                {endividamento.toFixed(1)}%
              </p>
              <Badge className={`mt-2 bg-${getIndicadorStatus(endividamento, "endividamento").variant}/10 text-${getIndicadorStatus(endividamento, "endividamento").variant}`}>
                {getIndicadorStatus(endividamento, "endividamento").label}
              </Badge>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-1">Composição PL</p>
              <p className="text-2xl font-bold">
                {composicaoPL.toFixed(1)}%
              </p>
              <Badge className={`mt-2 bg-${getIndicadorStatus(composicaoPL, "composicao").variant}/10 text-${getIndicadorStatus(composicaoPL, "composicao").variant}`}>
                {getIndicadorStatus(composicaoPL, "composicao").label}
              </Badge>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-1">Capital de Giro</p>
              <p className={`text-2xl font-bold ${capitalGiro >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(capitalGiro)}
              </p>
              <Badge className={`mt-2 bg-${getIndicadorStatus(capitalGiro, "giro").variant}/10 text-${getIndicadorStatus(capitalGiro, "giro").variant}`}>
                {getIndicadorStatus(capitalGiro, "giro").label}
              </Badge>
            </div>
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
