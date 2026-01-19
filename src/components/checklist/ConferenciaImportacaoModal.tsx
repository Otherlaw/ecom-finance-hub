// src/components/checklist/ConferenciaImportacaoModal.tsx
// Modal para exibir conferência detalhada após processamento de arquivo

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Calendar, 
  Hash,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import { getNomeMes } from "@/lib/validar-periodo-arquivo";

export interface ConferenciaData {
  nomeArquivo: string;
  tipoArquivoDetectado: string;
  periodoDetectado: { mes: number; ano: number } | null;
  periodoEsperado: { mes: number; ano: number };
  periodoCompativel: boolean;
  estatisticas: {
    totalLinhasArquivo: number;
    totalTransacoesGeradas: number;
    transacoesImportadas: number;
    duplicatasIgnoradas: number;
    transacoesComErro: number;
  };
  tiposMovimentacao: Array<{ tipo: string; quantidade: number; valor: number }>;
  amostraTransacoes: Array<{
    data: string;
    descricao: string;
    valor: number;
    status: "novo" | "duplicata" | "erro";
  }>;
}

interface ConferenciaImportacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ConferenciaData | null;
}

export function ConferenciaImportacaoModal({ 
  open, 
  onOpenChange, 
  data 
}: ConferenciaImportacaoModalProps) {
  if (!data) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusIcon = (status: "novo" | "duplicata" | "erro") => {
    switch (status) {
      case "novo":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "duplicata":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "erro":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusLabel = (status: "novo" | "duplicata" | "erro") => {
    switch (status) {
      case "novo": return "Importado";
      case "duplicata": return "Duplicata";
      case "erro": return "Erro";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Conferência de Importação
          </DialogTitle>
          <DialogDescription>
            Resultado do processamento do arquivo <strong>{data.nomeArquivo}</strong>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Resumo Geral */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{data.estatisticas.totalLinhasArquivo}</p>
                <p className="text-xs text-muted-foreground">Linhas no arquivo</p>
              </div>
              <div className="p-4 bg-success/10 rounded-lg text-center border border-success/20">
                <p className="text-2xl font-bold text-success">{data.estatisticas.transacoesImportadas}</p>
                <p className="text-xs text-muted-foreground">Importadas</p>
              </div>
              <div className="p-4 bg-warning/10 rounded-lg text-center border border-warning/20">
                <p className="text-2xl font-bold text-warning">{data.estatisticas.duplicatasIgnoradas}</p>
                <p className="text-xs text-muted-foreground">Duplicatas</p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg text-center border border-destructive/20">
                <p className="text-2xl font-bold text-destructive">{data.estatisticas.transacoesComErro}</p>
                <p className="text-xs text-muted-foreground">Com erro</p>
              </div>
            </div>

            {/* Período e Tipo */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Período detectado:</span>
                {data.periodoDetectado ? (
                  <Badge variant={data.periodoCompativel ? "default" : "destructive"}>
                    {getNomeMes(data.periodoDetectado.mes)}/{data.periodoDetectado.ano}
                  </Badge>
                ) : (
                  <Badge variant="outline">Não detectado</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Período esperado:</span>
                <Badge variant="outline">
                  {getNomeMes(data.periodoEsperado.mes)}/{data.periodoEsperado.ano}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Tipo:</span>
                <Badge variant="secondary">{data.tipoArquivoDetectado}</Badge>
              </div>
            </div>

            {/* Alerta de período incompatível */}
            {!data.periodoCompativel && data.periodoDetectado && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Período incompatível detectado
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      As transações foram importadas com as datas originais do arquivo.
                      Verifique se este é o arquivo correto para este checklist.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tipos de Movimentação */}
            {data.tiposMovimentacao.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Tipos de Movimentação Detectados
                </h4>
                <div className="space-y-2">
                  {data.tiposMovimentacao.map((tipo, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {tipo.valor >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        <span className="font-medium">{tipo.tipo}</span>
                        <Badge variant="outline" className="text-xs">
                          {tipo.quantidade} transações
                        </Badge>
                      </div>
                      <span className={tipo.valor >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                        {formatCurrency(tipo.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amostra de Transações */}
            {data.amostraTransacoes.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Amostra das Transações (primeiras 20)</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right w-[120px]">Valor</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.amostraTransacoes.map((transacao, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">
                            {transacao.data}
                          </TableCell>
                          <TableCell className="truncate max-w-[200px]">
                            {transacao.descricao}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${transacao.valor >= 0 ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(transacao.valor)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(transacao.status)}
                              <span className="text-xs">{getStatusLabel(transacao.status)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
