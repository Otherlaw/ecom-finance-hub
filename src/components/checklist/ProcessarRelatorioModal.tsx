/**
 * Modal para processar relatório de marketplace após upload.
 * Gera eventos financeiros em marketplace_financial_events.
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, FileSpreadsheet, AlertTriangle, CheckCircle, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { 
  importarRelatorioParaEventos, 
  validarPeriodoArquivo, 
  parsearCSVParaLinhas,
  MAPEAMENTOS_CANAIS,
  normalizarCanal,
  type LinhaRelatorio,
  type ResultadoImportacao 
} from "@/lib/checklist-importacao";

interface ProcessarRelatorioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arquivoUrl: string;
  arquivoNome: string;
  empresaId: string;
  canal: string;
  mesChecklist: number;
  anoChecklist: number;
  onSuccess: () => void;
}

type Etapa = 'carregando' | 'preview' | 'processando' | 'concluido' | 'erro';

export function ProcessarRelatorioModal({
  open,
  onOpenChange,
  arquivoUrl,
  arquivoNome,
  empresaId,
  canal,
  mesChecklist,
  anoChecklist,
  onSuccess,
}: ProcessarRelatorioModalProps) {
  const [etapa, setEtapa] = useState<Etapa>('carregando');
  const [linhasParseadas, setLinhasParseadas] = useState<LinhaRelatorio[]>([]);
  const [validacaoPeriodo, setValidacaoPeriodo] = useState<{ valido: boolean; mensagem: string } | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [canalSelecionado, setCanalSelecionado] = useState(normalizarCanal(canal));

  // Carregar e parsear arquivo ao abrir
  useEffect(() => {
    if (open && arquivoUrl) {
      carregarArquivo();
    }
  }, [open, arquivoUrl]);

  const carregarArquivo = async () => {
    setEtapa('carregando');
    setErro(null);
    
    try {
      const response = await fetch(arquivoUrl);
      const blob = await response.blob();
      
      const extensao = arquivoNome.toLowerCase().split('.').pop();
      let dados: string[][] = [];

      if (extensao === 'csv' || extensao === 'txt') {
        const texto = await blob.text();
        const parsed = Papa.parse(texto, { skipEmptyLines: true });
        dados = parsed.data as string[][];
      } else if (extensao === 'xlsx' || extensao === 'xls') {
        const buffer = await blob.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const primeiraSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[primeiraSheet];
        dados = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      } else {
        throw new Error(`Formato de arquivo não suportado: ${extensao}`);
      }

      if (dados.length < 2) {
        throw new Error("Arquivo vazio ou sem dados suficientes");
      }

      // Usar mapeamento do canal ou tentar detectar
      const mapeamento = MAPEAMENTOS_CANAIS[canalSelecionado] || MAPEAMENTOS_CANAIS.mercado_livre;
      const linhas = parsearCSVParaLinhas(dados, mapeamento);
      
      setLinhasParseadas(linhas);

      // Validar período
      const datas = linhas.map(l => l.data).filter(Boolean) as string[];
      const validacao = validarPeriodoArquivo(datas, mesChecklist, anoChecklist);
      setValidacaoPeriodo(validacao);

      setEtapa('preview');
    } catch (err: any) {
      console.error("Erro ao carregar arquivo:", err);
      setErro(err.message || "Erro ao processar arquivo");
      setEtapa('erro');
    }
  };

  const processarImportacao = async () => {
    setEtapa('processando');
    
    try {
      const result = await importarRelatorioParaEventos(
        linhasParseadas,
        empresaId,
        canalSelecionado
      );
      
      setResultado(result);
      setEtapa('concluido');
      
      if (result.erros.length === 0) {
        toast.success(`${result.eventosGerados} eventos importados com sucesso`);
        onSuccess();
      } else {
        toast.warning(`Importação concluída com ${result.erros.length} avisos`);
      }
    } catch (err: any) {
      console.error("Erro na importação:", err);
      setErro(err.message || "Erro ao importar dados");
      setEtapa('erro');
    }
  };

  const handleClose = () => {
    setEtapa('carregando');
    setLinhasParseadas([]);
    setValidacaoPeriodo(null);
    setResultado(null);
    setErro(null);
    onOpenChange(false);
  };

  // Estatísticas do preview
  const stats = {
    totalLinhas: linhasParseadas.length,
    comPedidoId: linhasParseadas.filter(l => l.pedido_id).length,
    semPedidoId: linhasParseadas.filter(l => !l.pedido_id).length,
    comComissao: linhasParseadas.filter(l => l.comissao && l.comissao > 0).length,
    comTarifa: linhasParseadas.filter(l => l.tarifa_fixa && l.tarifa_fixa > 0).length,
    comFrete: linhasParseadas.filter(l => l.frete_vendedor && l.frete_vendedor > 0).length,
    comAds: linhasParseadas.filter(l => l.ads && l.ads > 0).length,
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Processar Relatório
          </DialogTitle>
          <DialogDescription>
            {arquivoNome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* ETAPA: Carregando */}
          {etapa === 'carregando' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando arquivo...</p>
            </div>
          )}

          {/* ETAPA: Preview */}
          {etapa === 'preview' && (
            <>
              {/* Seletor de canal */}
              <div className="space-y-2">
                <Label>Canal do Marketplace</Label>
                <Select value={canalSelecionado} onValueChange={(v) => {
                  setCanalSelecionado(v);
                  // Re-parsear com novo mapeamento
                  carregarArquivo();
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                    <SelectItem value="shopee">Shopee</SelectItem>
                    <SelectItem value="shein">Shein</SelectItem>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="magalu">Magalu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Alerta de período */}
              {validacaoPeriodo && !validacaoPeriodo.valido && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{validacaoPeriodo.mensagem}</AlertDescription>
                </Alert>
              )}
              {validacaoPeriodo && validacaoPeriodo.valido && (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertDescription>{validacaoPeriodo.mensagem}</AlertDescription>
                </Alert>
              )}

              {/* Estatísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-bold">{stats.totalLinhas}</p>
                  <p className="text-xs text-muted-foreground">Total linhas</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10 text-center">
                  <p className="text-2xl font-bold text-success">{stats.comPedidoId}</p>
                  <p className="text-xs text-muted-foreground">Com pedido</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10 text-center">
                  <p className="text-2xl font-bold text-warning">{stats.semPedidoId}</p>
                  <p className="text-xs text-muted-foreground">Sem pedido</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 text-center">
                  <p className="text-2xl font-bold text-primary">{stats.comComissao}</p>
                  <p className="text-xs text-muted-foreground">Com comissão</p>
                </div>
              </div>

              {/* Tipos de eventos detectados */}
              <div className="space-y-2">
                <Label>Eventos que serão gerados:</Label>
                <div className="flex flex-wrap gap-2">
                  {stats.comComissao > 0 && (
                    <Badge variant="outline">Comissão ({stats.comComissao})</Badge>
                  )}
                  {stats.comTarifa > 0 && (
                    <Badge variant="outline">Tarifa Fixa ({stats.comTarifa})</Badge>
                  )}
                  {stats.comFrete > 0 && (
                    <Badge variant="outline">Frete Vendedor ({stats.comFrete})</Badge>
                  )}
                  {stats.comAds > 0 && (
                    <Badge variant="outline">Ads ({stats.comAds})</Badge>
                  )}
                </div>
              </div>

              {/* Aviso de competência */}
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Os dados serão importados como <strong>eventos de competência</strong> (fechamento mensal). 
                  Não afetam o Fluxo de Caixa diretamente.
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* ETAPA: Processando */}
          {etapa === 'processando' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importando eventos financeiros...</p>
              <Progress value={50} className="w-48" />
            </div>
          )}

          {/* ETAPA: Concluído */}
          {etapa === 'concluido' && resultado && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-success">
                <CheckCircle className="h-6 w-6" />
                <span className="text-lg font-medium">Importação concluída!</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-success/10 text-center">
                  <p className="text-2xl font-bold text-success">{resultado.eventosGerados}</p>
                  <p className="text-xs text-muted-foreground">Eventos gerados</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-bold">{resultado.totalLinhasProcessadas}</p>
                  <p className="text-xs text-muted-foreground">Linhas processadas</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10 text-center">
                  <p className="text-2xl font-bold text-warning">{resultado.linhasSemPedidoId}</p>
                  <p className="text-xs text-muted-foreground">Ignoradas (sem ID)</p>
                </div>
              </div>

              {/* Resumo por tipo */}
              {Object.keys(resultado.resumoPorTipo).length > 0 && (
                <div className="space-y-2">
                  <Label>Resumo por tipo:</Label>
                  <div className="space-y-1">
                    {Object.entries(resultado.resumoPorTipo).map(([tipo, { qtd, valor }]) => (
                      <div key={tipo} className="flex justify-between text-sm">
                        <span className="capitalize">{tipo.replace('_', ' ')}</span>
                        <span className="font-mono">
                          {qtd}x = R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resultado.erros.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {resultado.erros.length} erro(s): {resultado.erros[0]}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* ETAPA: Erro */}
          {etapa === 'erro' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {etapa === 'preview' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={processarImportacao} disabled={stats.comPedidoId === 0}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {stats.comPedidoId} eventos
              </Button>
            </>
          )}
          {etapa === 'concluido' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
          {etapa === 'erro' && (
            <>
              <Button variant="outline" onClick={handleClose}>Fechar</Button>
              <Button onClick={carregarArquivo}>Tentar novamente</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
