/**
 * Relatório de CMV & Margem por Produto
 * Motor de Custos V1
 */

import { useState, useMemo } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  Percent, 
  BarChart3,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCMV, useCMVPorProduto } from "@/hooks/useCMV";

// Formatação
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

export default function CMVRelatorio() {
  // Período padrão: mês atual
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [empresaId, setEmpresaId] = useState<string>("");
  const [periodoPreset, setPeriodoPreset] = useState<string>("mes_atual");

  // Dados
  const { empresas, isLoading: isLoadingEmpresas } = useEmpresas();
  const { registros, resumo, isLoading: isLoadingCMV, refetch } = useCMV({
    empresaId: empresaId || undefined,
    dataInicio,
    dataFim,
  });
  const { data: cmvPorProduto, isLoading: isLoadingPorProduto } = useCMVPorProduto({
    empresaId: empresaId || undefined,
    dataInicio,
    dataFim,
  });

  // Selecionar primeira empresa automaticamente
  useMemo(() => {
    if (empresas && empresas.length > 0 && !empresaId) {
      setEmpresaId(empresas[0].id);
    }
  }, [empresas, empresaId]);

  // Presets de período
  const handlePeriodoChange = (preset: string) => {
    setPeriodoPreset(preset);
    const hoje = new Date();

    switch (preset) {
      case "hoje":
        setDataInicio(format(hoje, "yyyy-MM-dd"));
        setDataFim(format(hoje, "yyyy-MM-dd"));
        break;
      case "7_dias":
        setDataInicio(format(subDays(hoje, 7), "yyyy-MM-dd"));
        setDataFim(format(hoje, "yyyy-MM-dd"));
        break;
      case "30_dias":
        setDataInicio(format(subDays(hoje, 30), "yyyy-MM-dd"));
        setDataFim(format(hoje, "yyyy-MM-dd"));
        break;
      case "mes_atual":
        setDataInicio(format(startOfMonth(hoje), "yyyy-MM-dd"));
        setDataFim(format(endOfMonth(hoje), "yyyy-MM-dd"));
        break;
      case "mes_anterior":
        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        setDataInicio(format(startOfMonth(mesAnterior), "yyyy-MM-dd"));
        setDataFim(format(endOfMonth(mesAnterior), "yyyy-MM-dd"));
        break;
    }
  };

  const isLoading = isLoadingEmpresas || isLoadingCMV || isLoadingPorProduto;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Relatório de CMV & Margem
              </h1>
              <p className="text-muted-foreground">
                Motor de Custos V1 - Custo Médio Contínuo
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Empresa</label>
                  <Select value={empresaId} onValueChange={setEmpresaId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(empresas || []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome_fantasia || e.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Período</label>
                  <Select value={periodoPreset} onValueChange={handlePeriodoChange}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="7_dias">Últimos 7 dias</SelectItem>
                      <SelectItem value="30_dias">Últimos 30 dias</SelectItem>
                      <SelectItem value="mes_atual">Mês atual</SelectItem>
                      <SelectItem value="mes_anterior">Mês anterior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">De</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value);
                      setPeriodoPreset("personalizado");
                    }}
                    className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => {
                      setDataFim(e.target.value);
                      setPeriodoPreset("personalizado");
                    }}
                    className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-16" />
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">CMV Total</span>
                    </div>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(resumo.totalCMV)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {resumo.registros} registros
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-16" />
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Receita Total</span>
                    </div>
                    <div className="text-2xl font-bold text-success">
                      {formatCurrency(resumo.totalReceita)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatNumber(resumo.quantidadeVendida)} unidades
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-16" />
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">Margem Bruta</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(resumo.margemBrutaTotal)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Receita - CMV
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-16" />
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Percent className="h-4 w-4" />
                      <span className="text-sm">Margem %</span>
                    </div>
                    <div className={`text-2xl font-bold ${resumo.margemPercentualMedia >= 20 ? "text-success" : resumo.margemPercentualMedia >= 10 ? "text-warning" : "text-destructive"}`}>
                      {formatPercent(resumo.margemPercentualMedia)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Margem média ponderada
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabela de CMV por Produto */}
          <Card>
            <CardHeader>
              <CardTitle>CMV por Produto</CardTitle>
              <CardDescription>
                Custo de mercadoria vendida e margem por produto no período
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (cmvPorProduto?.length || 0) === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum registro de CMV encontrado no período.</p>
                  <p className="text-sm mt-2">
                    Registre vendas para visualizar o custo de mercadoria vendida.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Qtd. Vendida</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead className="text-right">CMV Total</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Margem R$</TableHead>
                      <TableHead className="text-right">Margem %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cmvPorProduto?.map((item) => (
                      <TableRow key={item.produto.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.produto.nome}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {item.produto.codigo_interno}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.produto.categoria ? (
                            <Badge variant="outline">{item.produto.categoria}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(item.quantidade)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.produto.custo_medio_atual)}
                        </TableCell>
                        <TableCell className="text-right text-destructive font-medium">
                          {formatCurrency(item.custoTotal)}
                        </TableCell>
                        <TableCell className="text-right text-success font-medium">
                          {formatCurrency(item.receitaTotal)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.margemBruta)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              item.margemPercentual >= 20
                                ? "default"
                                : item.margemPercentual >= 10
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {formatPercent(item.margemPercentual)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Tabela de Registros Detalhados */}
          <Card>
            <CardHeader>
              <CardTitle>Registros Detalhados de CMV</CardTitle>
              <CardDescription>
                Histórico de todas as baixas de estoque e CMV gerado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : registros.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum registro encontrado no período.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">CMV</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registros.slice(0, 50).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(r.data), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate" title={r.produto?.nome}>
                            {r.produto?.nome || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.origem}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.canal ? (
                            <Badge variant="secondary">{r.canal}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(r.quantidade)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(r.custo_unitario_momento)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatCurrency(r.custo_total)}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          {r.receita_total ? formatCurrency(r.receita_total) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.margem_percentual !== undefined ? (
                            <span className={r.margem_percentual >= 0 ? "text-success" : "text-destructive"}>
                              {formatPercent(r.margem_percentual)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {registros.length > 50 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Exibindo 50 de {registros.length} registros
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
