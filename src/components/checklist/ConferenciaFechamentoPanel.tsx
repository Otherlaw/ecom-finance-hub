// src/components/checklist/ConferenciaFechamentoPanel.tsx
// Painel de conferência consolidada para fechamento mensal

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  FileUp,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getNomeMes } from "@/lib/validar-periodo-arquivo";

interface ConferenciaFechamentoPanelProps {
  empresaId: string;
  mes: number;
  ano: number;
}

interface FonteDados {
  nome: string;
  origem: string;
  transacoes: number;
  valorTotal: number;
  status: "ok" | "pendente" | "alerta";
}

export function ConferenciaFechamentoPanel({ 
  empresaId, 
  mes, 
  ano 
}: ConferenciaFechamentoPanelProps) {
  // Buscar dados de marketplace_transactions para o período
  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const dataFim = mes === 12 
    ? `${ano + 1}-01-01` 
    : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

  const { data: transacoes, isLoading, refetch } = useQuery({
    queryKey: ["conferencia-fechamento", empresaId, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_transactions")
        .select("id, canal, origem_extrato, tipo_lancamento, valor_liquido, valor_bruto, categoria_id, status")
        .eq("empresa_id", empresaId)
        .gte("data_transacao", dataInicio)
        .lt("data_transacao", dataFim);

      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Calcular métricas por fonte
  const metricas = useMemo(() => {
    if (!transacoes) {
      return {
        fontes: [] as FonteDados[],
        totalTransacoes: 0,
        totalCreditos: 0,
        totalDebitos: 0,
        semCategoria: 0,
        naoReconciliadas: 0,
      };
    }

    // Agrupar por origem_extrato
    const porOrigem: Record<string, { transacoes: number; valor: number }> = {};
    let totalCreditos = 0;
    let totalDebitos = 0;
    let semCategoria = 0;
    let naoReconciliadas = 0;

    for (const t of transacoes) {
      const origem = t.origem_extrato || "desconhecido";
      if (!porOrigem[origem]) {
        porOrigem[origem] = { transacoes: 0, valor: 0 };
      }
      porOrigem[origem].transacoes++;
      porOrigem[origem].valor += Number(t.valor_liquido) || 0;

      if (t.tipo_lancamento === "credito") {
        totalCreditos += Number(t.valor_liquido) || 0;
      } else {
        totalDebitos += Math.abs(Number(t.valor_liquido) || 0);
      }

      if (!t.categoria_id) semCategoria++;
      if (t.status !== "conciliado") naoReconciliadas++;
    }

    // Converter para array de fontes
    const fontes: FonteDados[] = Object.entries(porOrigem).map(([origem, dados]) => {
      let nome = origem;
      let status: "ok" | "pendente" | "alerta" = "ok";

      // Traduzir origens para nomes amigáveis
      if (origem === "ml_api" || origem === "api") nome = "API Mercado Livre";
      else if (origem === "ml_webhook" || origem === "webhook") nome = "Webhook ML";
      else if (origem === "checklist_upload") nome = "Upload Checklist";
      else if (origem === "importacao_csv") nome = "Importação CSV";
      else if (origem === "importacao_xlsx") nome = "Importação XLSX";

      if (dados.transacoes === 0) status = "pendente";

      return {
        nome,
        origem,
        transacoes: dados.transacoes,
        valorTotal: dados.valor,
        status,
      };
    });

    return {
      fontes,
      totalTransacoes: transacoes.length,
      totalCreditos,
      totalDebitos,
      semCategoria,
      naoReconciliadas,
    };
  }, [transacoes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusIcon = (status: "ok" | "pendente" | "alerta") => {
    switch (status) {
      case "ok": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "pendente": return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "alerta": return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando dados...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Conferência do Fechamento</h3>
          <p className="text-sm text-muted-foreground">
            {getNomeMes(mes)} de {ano}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Transações</span>
            </div>
            <p className="text-2xl font-bold">{metricas.totalTransacoes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-sm text-muted-foreground">Total Créditos</span>
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(metricas.totalCreditos)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Total Débitos</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(metricas.totalDebitos)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Minus className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Saldo Líquido</span>
            </div>
            <p className={`text-2xl font-bold ${metricas.totalCreditos - metricas.totalDebitos >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(metricas.totalCreditos - metricas.totalDebitos)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fontes de Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Fontes de Dados
          </CardTitle>
          <CardDescription>
            Origem das transações do período
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metricas.fontes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma transação encontrada neste período.</p>
              <p className="text-sm">Importe dados via API, checklist ou importação manual.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metricas.fontes.map((fonte, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(fonte.status)}
                    <div>
                      <p className="font-medium">{fonte.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {fonte.transacoes} transações
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${fonte.valorTotal >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(fonte.valorTotal)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas */}
      {(metricas.semCategoria > 0 || metricas.naoReconciliadas > 0) && (
        <Card className="border-warning/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Pendências para Fechamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metricas.semCategoria > 0 && (
              <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/20">
                <div>
                  <p className="font-medium text-warning">Transações sem categoria</p>
                  <p className="text-sm text-muted-foreground">
                    Categorize para que apareçam corretamente no DRE
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-warning border-warning">
                    {metricas.semCategoria}
                  </Badge>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/conciliacao">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Categorizar
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {metricas.naoReconciliadas > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-300">Transações não reconciliadas</p>
                  <p className="text-sm text-muted-foreground">
                    Pendentes de conferência na conciliação
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-amber-600 border-amber-400">
                    {metricas.naoReconciliadas}
                  </Badge>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/conciliacao">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Conciliar
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Valores para DRE/KPIs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valores Consolidados para DRE</CardTitle>
          <CardDescription>
            Dados que serão usados no fechamento mensal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span>Faturamento Bruto</span>
              <span className="font-medium">{formatCurrency(metricas.totalCreditos)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>Taxas e Tarifas</span>
              <span className="font-medium text-destructive">- {formatCurrency(metricas.totalDebitos)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between py-2">
              <span className="font-semibold">Faturamento Líquido</span>
              <span className={`font-bold text-lg ${metricas.totalCreditos - metricas.totalDebitos >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(metricas.totalCreditos - metricas.totalDebitos)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
