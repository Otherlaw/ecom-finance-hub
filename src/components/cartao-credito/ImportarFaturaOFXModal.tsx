import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, CreditCard, Building2, Calendar, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useCartoes } from "@/hooks/useCartoes";
import { supabase } from "@/integrations/supabase/client";
import { 
  parseOFX, 
  isValidOFX, 
  detectBank, 
  getTransactionTypeName,
  OFXTransaction,
  OFXParseResult 
} from "@/lib/ofx-parser";

interface ImportarFaturaOFXModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportarFaturaOFXModal({ open, onOpenChange }: ImportarFaturaOFXModalProps) {
  const [loading, setLoading] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>("");
  const [preview, setPreview] = useState<OFXTransaction[]>([]);
  const [parseResult, setParseResult] = useState<OFXParseResult | null>(null);
  const [detectedBank, setDetectedBank] = useState<string | null>(null);
  const { cartoes } = useCartoes();

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setArquivo(null);
      setCartaoSelecionado("");
      setPreview([]);
      setParseResult(null);
      setDetectedBank(null);
    }
  }, [open]);

  // Pré-selecionar cartão se houver apenas um
  useEffect(() => {
    if (open && cartoes && cartoes.length === 1 && !cartaoSelecionado) {
      setCartaoSelecionado(cartoes[0].id);
    }
  }, [open, cartoes, cartaoSelecionado]);

  /**
   * Read file with encoding detection (UTF-8 first, then Latin-1)
   */
  const readFileWithEncoding = async (file: File): Promise<string> => {
    // First try UTF-8
    const arrayBuffer = await file.arrayBuffer();
    
    // Try UTF-8 first
    let text = new TextDecoder('utf-8').decode(arrayBuffer);
    
    // Check for encoding declaration in OFX header
    const hasLatin1 = /CHARSET[:=]\s*(ISO-8859-1|1252|ANSI)/i.test(text) ||
                      /ENCODING[:=]\s*(ISO-8859-1|1252|ANSI)/i.test(text);
    
    // If Latin-1 declared or we see garbled characters, try Latin-1
    if (hasLatin1 || /Ã[£©§µ¡­ºóâêô]/.test(text)) {
      text = new TextDecoder('iso-8859-1').decode(arrayBuffer);
    }
    
    // Remove BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.substring(1);
    }
    
    return text;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);
    setPreview([]);
    setParseResult(null);
    setDetectedBank(null);

    try {
      // Read file with proper encoding detection
      const text = await readFileWithEncoding(file);
      
      console.log("OFX content preview:", text.substring(0, 500));
      
      // Validate OFX content
      if (!isValidOFX(text)) {
        console.warn("OFX validation failed. Content starts with:", text.substring(0, 200));
        toast.error("O arquivo não parece ser um OFX válido. Verifique o formato.");
        setArquivo(null);
        return;
      }
      
      // Detect bank
      const bank = detectBank(text);
      setDetectedBank(bank);
      
      // Parse OFX
      const result = parseOFX(text);
      console.log("OFX parse result:", { 
        transactionCount: result.transactions.length,
        dtStart: result.dtStart,
        dtEnd: result.dtEnd,
        bank: result.organization
      });
      
      setParseResult(result);
      
      if (result.transactions.length > 0) {
        setPreview(result.transactions.slice(0, 5));
        
        const bankInfo = bank ? ` (${bank})` : '';
        toast.success(`Arquivo OFX carregado${bankInfo}: ${result.transactions.length} transações encontradas`);
      } else {
        console.warn("No transactions found in OFX. Raw content:", text.substring(0, 1000));
        toast.error("Nenhuma transação encontrada no arquivo OFX.");
        setArquivo(null);
      }
    } catch (error: any) {
      console.error("Erro ao ler arquivo OFX:", error);
      toast.error("Erro ao ler arquivo OFX. Certifique-se de que é um arquivo válido.");
      setArquivo(null);
    }
  };

  const handleImport = async () => {
    if (!arquivo || !parseResult) {
      toast.error("Selecione um arquivo OFX para importar");
      return;
    }

    if (!cartaoSelecionado) {
      toast.error("Selecione o cartão correspondente");
      return;
    }

    setLoading(true);

    try {
      const { transactions, dtEnd } = parseResult;
      
      if (transactions.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo OFX.");
        setLoading(false);
        return;
      }
      
      // Extrair mês/ano da competência a partir da última data
      const effectiveDate = dtEnd || transactions[0]?.date || new Date().toISOString().split('T')[0];
      const dataRef = new Date(effectiveDate);
      const mesReferencia = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, '0')}-01`;
      const competencia = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, '0')}`;
      
      // Calcular valor total (apenas débitos para fatura de cartão)
      const valorTotal = transactions
        .filter(t => t.type === 'debito')
        .reduce((sum, t) => sum + t.amount, 0);

      // Verificar se já existe uma fatura para este cartão/mês
      const { data: existingInvoice } = await supabase
        .from("credit_card_invoices")
        .select("id, competencia")
        .eq("credit_card_id", cartaoSelecionado)
        .eq("mes_referencia", mesReferencia)
        .maybeSingle();

      let faturaId: string;

      if (existingInvoice) {
        // Fatura já existe - deletar transações antigas e atualizar
        const confirmReplace = window.confirm(
          `Já existe uma fatura para este cartão no mês ${competencia}. Deseja substituir as transações existentes?`
        );
        
        if (!confirmReplace) {
          setLoading(false);
          return;
        }

        // Deletar transações antigas
        await supabase
          .from("credit_card_transactions")
          .delete()
          .eq("invoice_id", existingInvoice.id);

        // Atualizar fatura existente
        const { error: updateError } = await supabase
          .from("credit_card_invoices")
          .update({
            data_fechamento: effectiveDate,
            data_vencimento: effectiveDate,
            valor_total: valorTotal,
            arquivo_importacao_url: arquivo.name,
            observacoes: detectedBank ? `Importado de: ${detectedBank} (atualizado)` : 'Atualizado',
          })
          .eq("id", existingInvoice.id);

        if (updateError) {
          console.error("Erro ao atualizar fatura:", updateError);
          toast.error("Erro ao atualizar fatura: " + updateError.message);
          setLoading(false);
          return;
        }

        faturaId = existingInvoice.id;
      } else {
        // Criar nova fatura
        const { data: fatura, error: faturaError } = await supabase
          .from("credit_card_invoices")
          .insert({
            credit_card_id: cartaoSelecionado,
            competencia,
            mes_referencia: mesReferencia,
            data_fechamento: effectiveDate,
            data_vencimento: effectiveDate,
            valor_total: valorTotal,
            status: "pendente",
            arquivo_importacao_url: arquivo.name,
            observacoes: detectedBank ? `Importado de: ${detectedBank}` : null,
          })
          .select()
          .single();

        if (faturaError) {
          console.error("Erro ao criar fatura:", faturaError);
          toast.error("Erro ao criar fatura: " + faturaError.message);
          setLoading(false);
          return;
        }

        faturaId = fatura.id;
      }

      // Criar transações
      const transacoesParaInserir = transactions.map((t) => ({
        invoice_id: faturaId,
        data_transacao: t.date,
        descricao: t.description,
        estabelecimento: t.name,
        valor: t.amount,
        tipo_movimento: t.type,
        tipo: "pontual" as const,
        status: "pendente" as const,
        observacoes: t.transactionType ? `Tipo: ${getTransactionTypeName(t.transactionType)}` : null,
      }));

      const { error: transacoesError } = await supabase
        .from("credit_card_transactions")
        .insert(transacoesParaInserir);

      if (transacoesError) {
        console.error("Erro ao criar transações:", transacoesError);
        toast.error("Erro ao importar transações: " + transacoesError.message);
      } else {
        const action = existingInvoice ? 'atualizada' : 'importada';
        toast.success(`Fatura ${action} com sucesso! ${transacoesParaInserir.length} transações criadas.`);
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error("Não foi possível processar o arquivo OFX. Verifique se o arquivo é uma fatura válida.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary stats
  const totalDebitos = parseResult?.transactions
    .filter(t => t.type === 'debito')
    .reduce((sum, t) => sum + t.amount, 0) || 0;
  
  const totalCreditos = parseResult?.transactions
    .filter(t => t.type === 'credito')
    .reduce((sum, t) => sum + t.amount, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Importar Fatura via OFX
          </DialogTitle>
          <DialogDescription>
            Faça upload do arquivo OFX da fatura do cartão de crédito para importar automaticamente todas as transações.
            Suporta arquivos dos principais bancos brasileiros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Selecione o Cartão</Label>
            <Select value={cartaoSelecionado} onValueChange={setCartaoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o cartão correspondente..." />
              </SelectTrigger>
              <SelectContent>
                {cartoes?.map((cartao: any) => (
                  <SelectItem key={cartao.id} value={cartao.id}>
                    {cartao.nome} - {cartao.instituicao_financeira} {cartao.ultimos_digitos ? `(****${cartao.ultimos_digitos})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Arquivo OFX da Fatura</Label>
            <Input
              type="file"
              accept=".ofx,.qfx"
              onChange={handleFileChange}
              disabled={loading || !cartaoSelecionado}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Formatos aceitos: .ofx, .qfx • Suporta: Nubank, Itaú, Bradesco, Santander, Inter, C6, BTG, BB e outros
            </p>
          </div>

          {/* Detected Bank & Summary */}
          {parseResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {detectedBank && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Building2 className="h-4 w-4" />
                    Banco Detectado
                  </div>
                  <p className="font-medium">{detectedBank}</p>
                </div>
              )}
              
              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  Período
                </div>
                <p className="font-medium text-sm">
                  {parseResult.dtStart} a {parseResult.dtEnd}
                </p>
              </div>
              
              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  Transações
                </div>
                <p className="font-medium">{parseResult.transactions.length}</p>
              </div>
              
              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Wallet className="h-4 w-4" />
                  Total Débitos
                </div>
                <p className="font-medium text-destructive">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalDebitos)}
                </p>
              </div>
            </div>
          )}

          {/* Transaction Preview */}
          {preview.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview ({preview.length} de {parseResult?.transactions.length || 0} transações)
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {preview.map((t, idx) => (
                  <div key={idx} className="text-sm p-3 border rounded bg-background">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-muted-foreground text-xs">{t.date}</span>
                          {t.transactionType && (
                            <Badge variant="outline" className="text-xs">
                              {getTransactionTypeName(t.transactionType)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={t.type === 'debito' ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                          {t.type === 'debito' ? '-' : '+'}{new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(t.amount)}
                        </p>
                        <Badge variant={t.type === 'debito' ? 'destructive' : 'default'} className="text-xs mt-1">
                          {t.type === 'debito' ? 'Débito' : 'Crédito'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Summary */}
              {(totalDebitos > 0 || totalCreditos > 0) && (
                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                  <span className="text-muted-foreground">Resumo:</span>
                  <div className="flex gap-4">
                    <span className="text-destructive">
                      Débitos: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalDebitos)}
                    </span>
                    {totalCreditos > 0 && (
                      <span className="text-green-600">
                        Créditos: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalCreditos)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={loading || !arquivo || !cartaoSelecionado}>
            {loading ? "Importando..." : "Importar Fatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}