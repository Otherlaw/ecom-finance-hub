import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDREData, usePeridosDisponiveis } from "@/hooks/useDREData";
import { useFluxoCaixa } from "@/hooks/useFluxoCaixa";
import { useMarketplaceTransactions } from "@/hooks/useMarketplaceTransactions";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useContasReceber } from "@/hooks/useContasReceber";
import { useEmpresas } from "@/hooks/useEmpresas";
import { AskAssistantButton } from "@/components/assistant/AskAssistantButton";
import { useAssistantChatContext } from "@/contexts/AssistantChatContext";
import { useMemo, useState } from "react";
import { format, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck,
  Download,
  Upload,
  Check,
  Clock,
  AlertTriangle,
  Store,
  Building2,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export default function Fechamento() {
  const { openChat } = useAssistantChatContext();
  
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return format(now, "yyyy-MM");
  });

  const [mes, ano] = selectedPeriod.split("-");
  const periodoInicio = `${ano}-${mes}-01`;
  const periodoFim = format(endOfMonth(new Date(parseInt(ano), parseInt(mes) - 1)), "yyyy-MM-dd");

  // Hooks de dados reais
  const { dreData, stats, isLoading: isDRELoading, hasData: hasDREData, transacoesCount } = useDREData(mes, parseInt(ano));
  const { resumo: fluxoResumo, isLoading: isFluxoLoading, hasData: hasFluxoData } = useFluxoCaixa({ periodoInicio, periodoFim });
  const { transacoes: marketplaceTransacoes, resumo: mktResumo, isLoading: isMktLoading } = useMarketplaceTransactions({ periodoInicio, periodoFim });
  const { resumo: contasPagarResumo, contas: contasPagar, isLoading: isCPLoading } = useContasPagar({ dataInicio: periodoInicio, dataFim: periodoFim });
  const { resumo: contasReceberResumo, contas: contasReceber, isLoading: isCRLoading } = useContasReceber({ dataInicio: periodoInicio, dataFim: periodoFim });
  const { empresas } = useEmpresas();

  const isLoading = isDRELoading || isFluxoLoading || isMktLoading || isCPLoading || isCRLoading;

  // Opções de período
  const periodoOpcoes = useMemo(() => {
    const opcoes = [];
    for (let i = 0; i < 12; i++) {
      const data = subMonths(new Date(), i);
      opcoes.push({
        value: format(data, "yyyy-MM"),
        label: format(data, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
      });
    }
    return opcoes;
  }, []);

  // Receita por canal
  const channelData = useMemo(() => {
    const porCanal: Record<string, { receita: number; taxas: number; liquido: number }> = {};
    marketplaceTransacoes.forEach(t => {
      const canal = t.canal_venda || t.canal || "Outros";
      if (!porCanal[canal]) {
        porCanal[canal] = { receita: 0, taxas: 0, liquido: 0 };
      }
      if (t.tipo_lancamento === "credito") {
        porCanal[canal].receita += Math.abs(t.valor_liquido);
        porCanal[canal].liquido += Math.abs(t.valor_liquido);
      } else {
        porCanal[canal].taxas += Math.abs(t.valor_liquido);
        porCanal[canal].liquido -= Math.abs(t.valor_liquido);
      }
    });
    const totalReceita = Object.values(porCanal).reduce((a, b) => a + b.receita, 0);
    return Object.entries(porCanal)
      .map(([channel, dados]) => ({
        channel,
        receitaBruta: dados.receita,
        taxas: dados.taxas,
        receitaLiquida: dados.liquido,
        percentual: totalReceita > 0 ? ((dados.receita / totalReceita) * 100).toFixed(1) : "0",
        color: getChannelColor(channel),
      }))
      .sort((a, b) => b.receitaBruta - a.receitaBruta);
  }, [marketplaceTransacoes]);

  // Resumo por empresa
  const empresaResumo = useMemo(() => {
    const porEmpresa: Record<string, { nome: string; receita: number; despesas: number; liquido: number }> = {};
    
    // Receitas de marketplace
    marketplaceTransacoes.forEach(t => {
      const empresaId = t.empresa_id;
      const empresa = empresas?.find(e => e.id === empresaId);
      const nome = empresa?.nome_fantasia || empresa?.razao_social || "Empresa não identificada";
      
      if (!porEmpresa[empresaId]) {
        porEmpresa[empresaId] = { nome, receita: 0, despesas: 0, liquido: 0 };
      }
      
      if (t.tipo_lancamento === "credito") {
        porEmpresa[empresaId].receita += Math.abs(t.valor_liquido);
      } else {
        porEmpresa[empresaId].despesas += Math.abs(t.valor_liquido);
      }
    });

    // Adicionar contas a pagar como despesas
    contasPagar?.forEach(c => {
      const empresaId = c.empresa_id;
      const empresa = empresas?.find(e => e.id === empresaId);
      const nome = empresa?.nome_fantasia || empresa?.razao_social || "Empresa não identificada";
      
      if (!porEmpresa[empresaId]) {
        porEmpresa[empresaId] = { nome, receita: 0, despesas: 0, liquido: 0 };
      }
      
      if (c.status === "pago") {
        porEmpresa[empresaId].despesas += c.valor_pago;
      }
    });

    // Adicionar contas a receber como receitas
    contasReceber?.forEach(c => {
      const empresaId = c.empresa_id;
      const empresa = empresas?.find(e => e.id === empresaId);
      const nome = empresa?.nome_fantasia || empresa?.razao_social || "Empresa não identificada";
      
      if (!porEmpresa[empresaId]) {
        porEmpresa[empresaId] = { nome, receita: 0, despesas: 0, liquido: 0 };
      }
      
      if (c.status === "recebido" || c.status === "parcialmente_recebido") {
        porEmpresa[empresaId].receita += c.valor_recebido;
      }
    });

    // Calcular líquido
    Object.values(porEmpresa).forEach(e => {
      e.liquido = e.receita - e.despesas;
    });

    return Object.values(porEmpresa).sort((a, b) => b.receita - a.receita);
  }, [marketplaceTransacoes, contasPagar, contasReceber, empresas]);

  // Status do fechamento
  const statusFechamento = useMemo(() => {
    const conciliacaoOk = mktResumo.conciliadas > 0 && mktResumo.pendentes === 0;
    const contasPagarOk = contasPagarResumo.totalVencido === 0;
    const contasReceberOk = contasReceberResumo.totalVencido === 0;
    const dreOk = hasDREData && transacoesCount > 0;
    
    return [
      { step: "Importação de dados", status: marketplaceTransacoes.length > 0 || transacoesCount > 0 ? "done" : "pending" },
      { step: "Conciliação marketplace", status: conciliacaoOk ? "done" : mktResumo.conciliadas > 0 ? "partial" : "pending" },
      { step: "Contas a pagar", status: contasPagarOk ? "done" : "attention" },
      { step: "Contas a receber", status: contasReceberOk ? "done" : "attention" },
      { step: "DRE consolidado", status: dreOk ? "done" : "pending" },
    ];
  }, [mktResumo, contasPagarResumo, contasReceberResumo, hasDREData, transacoesCount, marketplaceTransacoes]);

  const handleAskAssistant = () => {
    openChat('Explique os números deste fechamento mensal', {
      telaAtual: 'Fechamento Mensal',
      dadosAdicionais: {
        receitaBruta: dreData?.receitaBruta || 0,
        lucroBruto: dreData?.lucroBruto || 0,
        lucroLiquido: dreData?.lucroLiquido || 0,
        totalDespesas: dreData?.totalDespesas || 0,
        margemBruta: stats?.margemBruta || 0,
        margemLiquida: stats?.margemLiquida || 0,
        transacoesMarketplace: marketplaceTransacoes.length,
        contasPagarEmAberto: contasPagarResumo.totalEmAberto,
        contasReceberEmAberto: contasReceberResumo.totalEmAberto,
      },
    });
  };

  const periodoLabel = periodoOpcoes.find(p => p.value === selectedPeriod)?.label || selectedPeriod;

  return (
    <MainLayout
      title="Fechamento Mensal"
      subtitle="Consolidação dos resultados por operação"
      actions={
        <div className="flex items-center gap-2">
          <AskAssistantButton onClick={handleAskAssistant} label="Perguntar" />
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodoOpcoes.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando dados do fechamento...</span>
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Receita Bruta Total"
              value={formatCurrency(dreData?.receitaBruta || 0)}
              icon={TrendingUp}
              trend={dreData?.receitaBruta && dreData.receitaBruta > 0 ? "up" : "neutral"}
            />
            <KPICard
              title="Total Despesas"
              value={formatCurrency((dreData?.totalDespesas || 0) + (dreData?.custos?.valor || 0))}
              icon={TrendingDown}
              trend="neutral"
            />
            <KPICard
              title="Lucro Bruto"
              value={formatCurrency(dreData?.lucroBruto || 0)}
              icon={TrendingUp}
              trend={(dreData?.lucroBruto || 0) >= 0 ? "up" : "down"}
            />
            <KPICard
              title="Resultado Final"
              value={formatCurrency(dreData?.lucroLiquido || 0)}
              icon={(dreData?.lucroLiquido || 0) >= 0 ? TrendingUp : TrendingDown}
              trend={(dreData?.lucroLiquido || 0) >= 0 ? "up" : "down"}
            />
          </div>

          {/* Tabs por Operação */}
          <Tabs defaultValue="consolidado" className="space-y-6">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
              <TabsTrigger value="canais">Por Canal</TabsTrigger>
              <TabsTrigger value="empresas">Por Empresa</TabsTrigger>
            </TabsList>

            <TabsContent value="consolidado" className="space-y-6">
              {/* Resumo Geral */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ModuleCard title="Fluxo de Caixa" description={periodoLabel} icon={TrendingUp}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Entradas</span>
                      <span className="font-semibold text-success">{formatCurrency(fluxoResumo.totalEntradas)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Saídas</span>
                      <span className="font-semibold text-destructive">{formatCurrency(fluxoResumo.totalSaidas)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-medium">Saldo do Período</span>
                      <span className={`font-bold text-lg ${fluxoResumo.saldoFinal >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(fluxoResumo.saldoFinal)}
                      </span>
                    </div>
                  </div>
                </ModuleCard>

                <ModuleCard title="Marketplace" description={`${marketplaceTransacoes.length} transações`} icon={Store}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Créditos</span>
                      <span className="font-semibold text-success">{formatCurrency(mktResumo.totalCreditos)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Débitos (taxas/tarifas)</span>
                      <span className="font-semibold text-destructive">{formatCurrency(mktResumo.totalDebitos)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-medium">Líquido</span>
                      <span className={`font-bold text-lg ${(mktResumo.totalCreditos - mktResumo.totalDebitos) >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(mktResumo.totalCreditos - mktResumo.totalDebitos)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Conciliadas: {mktResumo.conciliadas} | Pendentes: {mktResumo.pendentes}
                    </div>
                  </div>
                </ModuleCard>
              </div>

              {/* Contas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ModuleCard title="Contas a Pagar" description="Resumo do período" icon={TrendingDown}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Pago</span>
                      <span className="font-semibold text-success">{formatCurrency(contasPagarResumo.totalPago)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Em Aberto</span>
                      <span className="font-semibold text-warning">{formatCurrency(contasPagarResumo.totalEmAberto)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Vencido</span>
                      <span className="font-semibold text-destructive">{formatCurrency(contasPagarResumo.totalVencido)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      {contasPagarResumo.quantidade} títulos no período
                    </div>
                  </div>
                </ModuleCard>

                <ModuleCard title="Contas a Receber" description="Resumo do período" icon={TrendingUp}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Recebido</span>
                      <span className="font-semibold text-success">{formatCurrency(contasReceberResumo.totalRecebido)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Em Aberto</span>
                      <span className="font-semibold text-warning">{formatCurrency(contasReceberResumo.totalEmAberto)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Vencido</span>
                      <span className="font-semibold text-destructive">{formatCurrency(contasReceberResumo.totalVencido)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      {contasReceberResumo.quantidade} títulos no período
                    </div>
                  </div>
                </ModuleCard>
              </div>
            </TabsContent>

            <TabsContent value="canais" className="space-y-6">
              <ModuleCard
                title="Receita por Canal"
                description="Detalhamento por marketplace"
                icon={Store}
                noPadding
              >
                {channelData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/30">
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Receita Bruta</TableHead>
                        <TableHead className="text-right">Taxas/Tarifas</TableHead>
                        <TableHead className="text-right">Receita Líquida</TableHead>
                        <TableHead className="text-right">% Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channelData.map((channel) => (
                        <TableRow key={channel.channel}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: channel.color }}
                              />
                              <span className="font-medium">{channel.channel}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(channel.receitaBruta)}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            -{formatCurrency(channel.taxas)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-success">
                            {formatCurrency(channel.receitaLiquida)}
                          </TableCell>
                          <TableCell className="text-right">
                            {channel.percentual}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhuma transação de marketplace no período
                  </div>
                )}
              </ModuleCard>
            </TabsContent>

            <TabsContent value="empresas" className="space-y-6">
              {empresaResumo.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {empresaResumo.map((op) => (
                    <ModuleCard
                      key={op.nome}
                      title={op.nome}
                      description="Resumo da operação"
                      icon={Building2}
                    >
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Receita Bruta</p>
                            <p className="text-xl font-bold">{formatCurrency(op.receita)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Despesas</p>
                            <p className="text-xl font-bold text-destructive">-{formatCurrency(op.despesas)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Líquido</p>
                            <p className={`text-xl font-bold ${op.liquido >= 0 ? "text-success" : "text-destructive"}`}>
                              {formatCurrency(op.liquido)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t border-border">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Margem</span>
                            <span className="font-medium">
                              {op.receita > 0 ? ((op.liquido / op.receita) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                          <Progress 
                            value={op.receita > 0 ? Math.max(0, Math.min(100, (op.liquido / op.receita) * 100)) : 0} 
                            className="h-2" 
                          />
                        </div>
                      </div>
                    </ModuleCard>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sem dados por empresa</h3>
                  <p className="text-sm">Importe transações de marketplace ou registre contas para ver o resumo por empresa.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Status do Fechamento */}
          <div className="mt-6">
            <ModuleCard title="Status do Fechamento" description="Etapas do mês" icon={CalendarCheck}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {statusFechamento.map((item, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border text-center ${
                      item.status === "done"
                        ? "bg-success/5 border-success/20"
                        : item.status === "partial"
                        ? "bg-info/5 border-info/20"
                        : item.status === "attention"
                        ? "bg-warning/5 border-warning/20"
                        : "bg-muted/50 border-border"
                    }`}
                  >
                    {item.status === "done" ? (
                      <Check className="h-6 w-6 mx-auto mb-2 text-success" />
                    ) : item.status === "partial" ? (
                      <Clock className="h-6 w-6 mx-auto mb-2 text-info" />
                    ) : item.status === "attention" ? (
                      <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-warning" />
                    ) : (
                      <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">{item.step}</p>
                    <Badge
                      className={`mt-2 ${
                        item.status === "done"
                          ? "bg-success/10 text-success"
                          : item.status === "partial"
                          ? "bg-info/10 text-info"
                          : item.status === "attention"
                          ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.status === "done" ? "Concluído" : item.status === "partial" ? "Parcial" : item.status === "attention" ? "Atenção" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </ModuleCard>
          </div>
        </>
      )}
    </MainLayout>
  );
}

function getChannelColor(channel: string): string {
  const colors: Record<string, string> = {
    "Mercado Livre": "hsl(48, 96%, 53%)",
    "Shopee": "hsl(14, 100%, 57%)",
    "Shein": "hsl(0, 0%, 20%)",
    "TikTok Shop": "hsl(349, 100%, 50%)",
    "Amazon": "hsl(33, 100%, 50%)",
    "Magalu": "hsl(210, 100%, 50%)",
  };
  return colors[channel] || "hsl(220, 14%, 46%)";
}
