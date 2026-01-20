/**
 * Modal de Resumo Detalhado da Importação
 * 
 * Exibe breakdown completo do resultado do processamento:
 * - Resumo geral (importadas, duplicatas, erros)
 * - Breakdown por tipo de lançamento e transação
 * - Onde os dados vão refletir no sistema
 * - Próximos passos com links de ação
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  Wallet,
  BarChart3,
  ClipboardCheck,
  ExternalLink,
  Calendar,
  Tag
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ResultadoProcessamento {
  resumo?: {
    total_linhas_arquivo?: number;
    transacoes_importadas?: number;
    transacoes_duplicadas?: number;
    transacoes_com_erro?: number;
  };
  por_tipo_lancamento?: {
    [key: string]: {
      quantidade: number;
      valor_total: number;
    };
  };
  por_tipo_transacao?: {
    [key: string]: {
      quantidade: number;
      valor: number;
    };
  };
  periodo_dados?: {
    data_inicio?: string;
    data_fim?: string;
  };
  fluxo_dados?: {
    origem: string;
    destinos: string[];
  };
  proximos_passos?: Array<{
    acao: string;
    pendentes: number;
    link: string;
  }>;
}

interface ImportResultDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeArquivo: string;
  canal: string;
  resultado?: ResultadoProcessamento | null;
  status: "concluido" | "erro";
  mensagemErro?: string;
}

export function ImportResultDetailModal({
  open,
  onOpenChange,
  nomeArquivo,
  canal,
  resultado,
  status,
  mensagemErro,
}: ImportResultDetailModalProps) {
  const navigate = useNavigate();
  
  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(valor);
  };
  
  const formatarNumero = (num: number) => {
    return new Intl.NumberFormat("pt-BR").format(num);
  };
  
  const formatarData = (dataStr?: string) => {
    if (!dataStr) return "-";
    return new Date(dataStr).toLocaleDateString("pt-BR");
  };

  const handleNavigate = (link: string) => {
    onOpenChange(false);
    navigate(link);
  };

  // Labels para tipos de transação
  const tipoTransacaoLabels: Record<string, string> = {
    venda: "Vendas",
    tarifa: "Tarifas",
    frete: "Frete",
    ads: "Publicidade",
    estorno: "Estornos",
    repasse: "Repasses",
    outro: "Outros"
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Resultado da Importação
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="font-medium">{nomeArquivo}</span>
            <Badge variant="outline">{canal}</Badge>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            
            {/* Status da Importação */}
            {status === "erro" ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Erro no Processamento</span>
                  </div>
                  <p className="text-sm text-red-600 mt-2">{mensagemErro || "Erro desconhecido"}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Cards de Resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4 pb-3 px-3">
                      <div className="text-2xl font-bold text-foreground">
                        {formatarNumero(resultado?.resumo?.total_linhas_arquivo || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">Total no arquivo</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-4 pb-3 px-3">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-2xl font-bold text-green-700">
                          {formatarNumero(resultado?.resumo?.transacoes_importadas || 0)}
                        </span>
                      </div>
                      <p className="text-xs text-green-600">Importadas</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="pt-4 pb-3 px-3">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-2xl font-bold text-yellow-700">
                          {formatarNumero(resultado?.resumo?.transacoes_duplicadas || 0)}
                        </span>
                      </div>
                      <p className="text-xs text-yellow-600">Duplicadas</p>
                    </CardContent>
                  </Card>
                  
                  <Card className={`${(resultado?.resumo?.transacoes_com_erro || 0) > 0 ? "bg-red-50 border-red-200" : "bg-muted/30"}`}>
                    <CardContent className="pt-4 pb-3 px-3">
                      <div className="flex items-center gap-1">
                        <XCircle className={`h-4 w-4 ${(resultado?.resumo?.transacoes_com_erro || 0) > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                        <span className={`text-2xl font-bold ${(resultado?.resumo?.transacoes_com_erro || 0) > 0 ? "text-red-700" : "text-muted-foreground"}`}>
                          {formatarNumero(resultado?.resumo?.transacoes_com_erro || 0)}
                        </span>
                      </div>
                      <p className={`text-xs ${(resultado?.resumo?.transacoes_com_erro || 0) > 0 ? "text-red-600" : "text-muted-foreground"}`}>Com erro</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Período dos Dados */}
                {resultado?.periodo_dados && (resultado.periodo_dados.data_inicio || resultado.periodo_dados.data_fim) && (
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Período dos dados:</span>
                        <span className="font-medium">
                          {formatarData(resultado.periodo_dados.data_inicio)} a {formatarData(resultado.periodo_dados.data_fim)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Breakdown por Tipo de Lançamento */}
                {resultado?.por_tipo_lancamento && Object.keys(resultado.por_tipo_lancamento).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Por Tipo de Lançamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="space-y-2">
                        {Object.entries(resultado.por_tipo_lancamento).map(([tipo, dados]) => (
                          <div key={tipo} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant={tipo === "credito" ? "default" : "secondary"}>
                                {tipo === "credito" ? "Crédito" : "Débito"}
                              </Badge>
                              <span className="text-muted-foreground">
                                {formatarNumero(dados.quantidade)} transações
                              </span>
                            </div>
                            <span className={`font-medium ${tipo === "credito" ? "text-green-600" : "text-red-600"}`}>
                              {tipo === "debito" ? "-" : ""}{formatarValor(Math.abs(dados.valor_total))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Breakdown por Tipo de Transação */}
                {resultado?.por_tipo_transacao && Object.keys(resultado.por_tipo_transacao).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Por Tipo de Transação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="space-y-2">
                        {Object.entries(resultado.por_tipo_transacao)
                          .sort((a, b) => b[1].valor - a[1].valor)
                          .map(([tipo, dados]) => (
                            <div key={tipo} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {tipoTransacaoLabels[tipo.toLowerCase()] || tipo}
                                </span>
                                <span className="text-muted-foreground">
                                  ({formatarNumero(dados.quantidade)})
                                </span>
                              </div>
                              <span className={`font-medium ${dados.valor >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatarValor(dados.valor)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                {/* Onde os Dados Vão Refletir */}
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm">Onde os dados vão refletir</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                        <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Vendas</p>
                          <p className="text-xs text-muted-foreground">
                            Após mapeamento de SKU
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                        <Wallet className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">DRE</p>
                          <p className="text-xs text-muted-foreground">
                            Após categorização
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                        <BarChart3 className="h-4 w-4 text-purple-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Fluxo de Caixa</p>
                          <p className="text-xs text-muted-foreground">
                            Após sincronização MEU
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                        <ClipboardCheck className="h-4 w-4 text-orange-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Fechamento Mensal</p>
                          <p className="text-xs text-muted-foreground">
                            Receita do período
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Próximos Passos */}
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Próximos Passos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-2">
                      {resultado?.proximos_passos && resultado.proximos_passos.length > 0 ? (
                        resultado.proximos_passos.map((passo, index) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg border bg-background">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                {index + 1}
                              </div>
                              <span className="text-sm">{passo.acao}</span>
                              {passo.pendentes > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {formatarNumero(passo.pendentes)} pendentes
                                </Badge>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleNavigate(passo.link)}
                            >
                              Ir <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex items-center justify-between p-2 rounded-lg border bg-background">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                1
                              </div>
                              <span className="text-sm">Categorizar transações pendentes</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleNavigate("/conciliacao?tab=marketplace")}
                            >
                              Ir <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                          
                          <div className="flex items-center justify-between p-2 rounded-lg border bg-background">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                2
                              </div>
                              <span className="text-sm">Mapear SKUs não identificados</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleNavigate("/mapeamentos-marketplace")}
                            >
                              Ir <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                          
                          <div className="flex items-center justify-between p-2 rounded-lg border bg-background">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                3
                              </div>
                              <span className="text-sm">Verificar vendas importadas</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleNavigate("/vendas")}
                            >
                              Ir <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
