/**
 * Modal de Validação de Arquivo Unificado
 * 
 * Consolida todos os alertas de validação pré-upload:
 * - Período: arquivo é do mês/ano do checklist?
 * - Empresa: CNPJ bate com empresa do checklist?
 * - Arquivo: hash já existe (duplicado)?
 * - Dados: transações já existem em marketplace_transactions?
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  Building2,
  FileCheck,
  Database,
  Loader2,
  Info
} from "lucide-react";
import { ValidacaoEmpresa } from "@/lib/validar-empresa-arquivo";
import { ValidacaoDuplicidade } from "@/lib/validar-arquivo-duplicado";
import { ValidacaoSobreposicao } from "@/lib/validar-sobreposicao-dados";

interface ValidacaoPeriodo {
  valido: boolean;
  mesArquivo?: number;
  anoArquivo?: number;
  mesChecklist: number;
  anoChecklist: number;
  mensagem?: string;
}

interface ValidacaoArquivoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  validacaoPeriodo?: ValidacaoPeriodo;
  validacaoEmpresa?: ValidacaoEmpresa;
  validacaoDuplicidade?: ValidacaoDuplicidade;
  validacaoSobreposicao?: ValidacaoSobreposicao;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ValidacaoArquivoModal({
  open,
  onOpenChange,
  fileName,
  validacaoPeriodo,
  validacaoEmpresa,
  validacaoDuplicidade,
  validacaoSobreposicao,
  isLoading = false,
  onConfirm,
  onCancel,
}: ValidacaoArquivoModalProps) {
  
  // Determinar se pode prosseguir
  const temBloqueio = validacaoDuplicidade?.duplicado === true;
  const temErro = 
    validacaoEmpresa?.alertaIncompatibilidade === true ||
    validacaoSobreposicao?.alertaNivel === "error";
  const temAviso = 
    (validacaoPeriodo && !validacaoPeriodo.valido) ||
    validacaoSobreposicao?.alertaNivel === "warning";
  
  const tudoOk = !temBloqueio && !temErro && !temAviso;
  
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const renderStatus = (tipo: "ok" | "warning" | "error" | "blocked" | "loading") => {
    switch (tipo) {
      case "ok":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "blocked":
        return <XCircle className="h-5 w-5 text-red-700" />;
      case "loading":
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Validação do Arquivo
          </DialogTitle>
          <DialogDescription>
            Verificando: <span className="font-medium">{fileName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando arquivo...</p>
            </div>
          ) : (
            <>
              {/* Validação de Período */}
              {validacaoPeriodo && (
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                  validacaoPeriodo.valido 
                    ? "bg-green-50 border-green-200" 
                    : "bg-yellow-50 border-yellow-200"
                }`}>
                  {renderStatus(validacaoPeriodo.valido ? "ok" : "warning")}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Período</span>
                      <Badge variant={validacaoPeriodo.valido ? "default" : "secondary"}>
                        {validacaoPeriodo.valido ? "Compatível" : "Divergente"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {validacaoPeriodo.valido 
                        ? `Arquivo corresponde a ${meses[validacaoPeriodo.mesChecklist - 1]}/${validacaoPeriodo.anoChecklist}`
                        : validacaoPeriodo.mensagem || `Arquivo é de período diferente do checklist (${meses[validacaoPeriodo.mesChecklist - 1]}/${validacaoPeriodo.anoChecklist})`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Validação de Empresa */}
              {validacaoEmpresa && (
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                  validacaoEmpresa.valida 
                    ? "bg-green-50 border-green-200" 
                    : "bg-red-50 border-red-200"
                }`}>
                  {renderStatus(validacaoEmpresa.valida ? "ok" : "error")}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Empresa</span>
                      <Badge variant={validacaoEmpresa.valida ? "default" : "destructive"}>
                        {validacaoEmpresa.valida ? "Verificada" : "Divergente"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {validacaoEmpresa.cnpjArquivo 
                        ? validacaoEmpresa.mensagem
                        : "CNPJ não encontrado no arquivo para validação"
                      }
                    </p>
                    {validacaoEmpresa.alertaIncompatibilidade && (
                      <div className="mt-2 text-xs">
                        <p>• CNPJ do arquivo: <strong>{validacaoEmpresa.cnpjArquivo}</strong></p>
                        <p>• CNPJ da empresa: <strong>{validacaoEmpresa.cnpjEmpresa}</strong></p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Validação de Duplicidade de Arquivo */}
              {validacaoDuplicidade && (
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                  validacaoDuplicidade.duplicado 
                    ? "bg-red-100 border-red-300" 
                    : "bg-green-50 border-green-200"
                }`}>
                  {renderStatus(validacaoDuplicidade.duplicado ? "blocked" : "ok")}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Arquivo</span>
                      <Badge variant={validacaoDuplicidade.duplicado ? "destructive" : "default"}>
                        {validacaoDuplicidade.duplicado ? "Duplicado" : "Novo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {validacaoDuplicidade.mensagem}
                    </p>
                    {validacaoDuplicidade.arquivoOriginal && (
                      <div className="mt-2 text-xs bg-red-50 p-2 rounded">
                        <p>Este arquivo foi importado em:</p>
                        <p className="font-medium">
                          {validacaoDuplicidade.arquivoOriginal.checklistNome} - {validacaoDuplicidade.arquivoOriginal.checklistMesAno}
                        </p>
                        <p className="text-muted-foreground">
                          Data: {validacaoDuplicidade.arquivoOriginal.dataUpload.toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Validação de Sobreposição de Dados */}
              {validacaoSobreposicao && (
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                  validacaoSobreposicao.alertaNivel === "error" 
                    ? "bg-red-50 border-red-200"
                    : validacaoSobreposicao.alertaNivel === "warning"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-green-50 border-green-200"
                }`}>
                  {renderStatus(
                    validacaoSobreposicao.alertaNivel === "error" 
                      ? "error" 
                      : validacaoSobreposicao.alertaNivel === "warning" 
                      ? "warning" 
                      : "ok"
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Dados</span>
                      <Badge variant={
                        validacaoSobreposicao.percentualExistente >= 80 
                          ? "destructive" 
                          : validacaoSobreposicao.percentualExistente >= 50 
                          ? "secondary" 
                          : "default"
                      }>
                        {validacaoSobreposicao.percentualExistente}% existentes
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {validacaoSobreposicao.mensagem}
                    </p>
                    {validacaoSobreposicao.transacoesAmostra > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Amostra: {validacaoSobreposicao.transacoesJaExistentes} de {validacaoSobreposicao.transacoesAmostra} transações já no sistema
                      </p>
                    )}
                    {validacaoSobreposicao.periodoDetectado && (
                      <p className="text-xs text-muted-foreground">
                        Período: {new Date(validacaoSobreposicao.periodoDetectado.dataInicio).toLocaleDateString("pt-BR")} a {new Date(validacaoSobreposicao.periodoDetectado.dataFim).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Resumo */}
              {!isLoading && (
                <div className={`p-3 rounded-lg border ${
                  temBloqueio 
                    ? "bg-red-100 border-red-300"
                    : temErro 
                    ? "bg-red-50 border-red-200"
                    : temAviso 
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-green-50 border-green-200"
                }`}>
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span className="font-medium text-sm">
                      {temBloqueio 
                        ? "Importação bloqueada"
                        : temErro 
                        ? "Atenção: problemas detectados"
                        : temAviso 
                        ? "Avisos: verifique antes de continuar"
                        : "Arquivo validado com sucesso"
                      }
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {temBloqueio 
                      ? "Este arquivo já foi importado. Não é possível importar novamente."
                      : temErro 
                      ? "Há problemas que podem causar dados incorretos. Recomendamos verificar o arquivo."
                      : temAviso 
                      ? "Você pode continuar, mas verifique se está importando o arquivo correto."
                      : "Todas as validações passaram. Você pode importar com segurança."
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          {!temBloqueio && (
            <Button 
              onClick={onConfirm}
              disabled={isLoading}
              variant={temErro ? "destructive" : temAviso ? "secondary" : "default"}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : temErro || temAviso ? (
                "Importar Mesmo Assim"
              ) : (
                "Importar"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
