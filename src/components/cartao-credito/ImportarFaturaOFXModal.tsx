import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useCartoes } from "@/hooks/useCartoes";
import { supabase } from "@/integrations/supabase/client";
import * as OFX from "ofx-js";

interface ImportarFaturaOFXModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportarFaturaOFXModal({ open, onOpenChange }: ImportarFaturaOFXModalProps) {
  const [loading, setLoading] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>("");
  const [preview, setPreview] = useState<any[]>([]);
  const { cartoes } = useCartoes();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);

    try {
      const text = await file.text();
      const ofxData = OFX.parse(text);
      
      if (ofxData?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS?.BANKTRANLIST?.STMTTRN) {
        const transactions = ofxData.OFX.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.BANKTRANLIST.STMTTRN;
        const transactionArray = Array.isArray(transactions) ? transactions : [transactions];
        
        setPreview(transactionArray.slice(0, 5));
        toast.success(`Arquivo OFX carregado: ${transactionArray.length} transações encontradas`);
      } else {
        toast.error("Formato OFX não reconhecido. Verifique o arquivo.");
      }
    } catch (error) {
      toast.error("Erro ao ler arquivo OFX. Certifique-se de que é um arquivo válido.");
      console.error(error);
    }
  };

  const handleImport = async () => {
    if (!arquivo) {
      toast.error("Selecione um arquivo OFX para importar");
      return;
    }

    if (!cartaoSelecionado) {
      toast.error("Selecione o cartão correspondente");
      return;
    }

    setLoading(true);

    try {
      const text = await arquivo.text();
      const ofxData = OFX.parse(text);
      
      const transactions = ofxData?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS?.BANKTRANLIST?.STMTTRN;
      const transactionArray = Array.isArray(transactions) ? transactions : [transactions];
      
      // Extrair dados da fatura
      const ccStmt = ofxData.OFX.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS;
      const dtStart = ccStmt.BANKTRANLIST.DTSTART;
      const dtEnd = ccStmt.BANKTRANLIST.DTEND;
      
      // Extrair mês/ano da competência
      const dataFechamento = new Date(dtEnd);
      const competencia = `${dataFechamento.getFullYear()}-${String(dataFechamento.getMonth() + 1).padStart(2, '0')}`;
      
      // Calcular valor total
      const valorTotal = transactionArray.reduce((sum: number, t: any) => {
        const valor = parseFloat(t.TRNAMT) || 0;
        return sum + Math.abs(valor);
      }, 0);

      // Criar fatura
      const { data: fatura, error: faturaError } = await supabase
        .from("credit_card_invoices")
        .insert({
          credit_card_id: cartaoSelecionado,
          competencia,
          mes_referencia: competencia + "-01",
          data_fechamento: dtEnd,
          data_vencimento: dtEnd,
          valor_total: valorTotal,
          status: "pendente",
          arquivo_importacao_url: arquivo.name,
        })
        .select()
        .single();

      if (faturaError) {
        console.error("Erro ao criar fatura:", faturaError);
        toast.error("Erro ao criar fatura: " + faturaError.message);
        setLoading(false);
        return;
      }

      // Criar transações
      const transacoesParaInserir = transactionArray.map((t: any) => {
        const valor = parseFloat(t.TRNAMT) || 0;
        const tipoMovimento = valor < 0 ? "debito" : "credito";
        
        return {
          invoice_id: fatura.id,
          data_transacao: t.DTPOSTED,
          descricao: t.MEMO || t.NAME || "Transação sem descrição",
          estabelecimento: t.NAME || null,
          valor: Math.abs(valor),
          tipo_movimento: tipoMovimento,
          tipo: "pontual",
          status: "pendente",
        };
      });

      const { error: transacoesError } = await supabase
        .from("credit_card_transactions")
        .insert(transacoesParaInserir);

      if (transacoesError) {
        console.error("Erro ao criar transações:", transacoesError);
        toast.error("Erro ao importar transações: " + transacoesError.message);
      } else {
        toast.success(`Fatura importada com sucesso! ${transacoesParaInserir.length} transações criadas.`);
        onOpenChange(false);
        setCartaoSelecionado("");
        setArquivo(null);
        setPreview([]);
      }
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error("Erro ao processar arquivo OFX: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Importar Fatura via OFX
          </DialogTitle>
          <DialogDescription>
            Faça upload do arquivo OFX da fatura do cartão de crédito para importar automaticamente todas as transações.
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
                {cartoes?.map((cartao) => (
                  <SelectItem key={cartao.id} value={cartao.id}>
                    {cartao.nome} - {cartao.instituicao_financeira} (****{cartao.ultimos_digitos})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Arquivo OFX da Fatura</Label>
            <Input
              type="file"
              accept=".ofx"
              onChange={handleFileChange}
              disabled={loading || !cartaoSelecionado}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Formato aceito: .ofx (padrão bancário para extratos)
            </p>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview (primeiras 5 transações)
              </h4>
              <div className="space-y-2">
                {preview.map((t: any, idx: number) => {
                  const valor = parseFloat(t.TRNAMT) || 0;
                  const tipo = valor < 0 ? "Débito" : "Crédito";
                  
                  return (
                    <div key={idx} className="text-sm p-2 border rounded bg-background">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{t.NAME || t.MEMO}</p>
                          <p className="text-muted-foreground text-xs">{t.DTPOSTED}</p>
                        </div>
                        <div className="text-right">
                          <p className={valor < 0 ? "text-destructive" : "text-green-600"}>
                            {tipo}: {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(Math.abs(valor))}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
