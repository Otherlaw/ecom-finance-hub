import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useCartoes } from "@/hooks/useCartoes";
import { supabase } from "@/integrations/supabase/client";
import { parseOFX, isValidOFX, OFXTransaction } from "@/lib/ofx-parser";

interface ImportarFaturaOFXModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportarFaturaOFXModal({ open, onOpenChange }: ImportarFaturaOFXModalProps) {
  const [loading, setLoading] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>("");
  const [preview, setPreview] = useState<OFXTransaction[]>([]);
  const [totalTransacoes, setTotalTransacoes] = useState(0);
  const { cartoes } = useCartoes();

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setArquivo(null);
      setCartaoSelecionado("");
      setPreview([]);
      setTotalTransacoes(0);
    }
  }, [open]);

  // Pré-selecionar cartão se houver apenas um
  useEffect(() => {
    if (open && cartoes && cartoes.length === 1 && !cartaoSelecionado) {
      setCartaoSelecionado(cartoes[0].id);
    }
  }, [open, cartoes, cartaoSelecionado]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);
    setPreview([]);
    setTotalTransacoes(0);

    try {
      const text = await file.text();
      
      // Validate OFX content
      if (!isValidOFX(text)) {
        toast.error("O arquivo não parece ser um OFX válido. Verifique o formato.");
        setArquivo(null);
        return;
      }
      
      const result = parseOFX(text);
      
      if (result.transactions.length > 0) {
        setPreview(result.transactions.slice(0, 5));
        setTotalTransacoes(result.transactions.length);
        toast.success(`Arquivo OFX carregado: ${result.transactions.length} transações encontradas`);
      } else {
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
      const result = parseOFX(text);
      
      if (result.transactions.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo OFX.");
        setLoading(false);
        return;
      }
      
      // Extrair mês/ano da competência a partir da última data
      const dtEnd = result.dtEnd || result.transactions[0]?.date || new Date().toISOString().split('T')[0];
      const dataRef = new Date(dtEnd);
      const mesReferencia = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, '0')}-01`;
      const competencia = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, '0')}`;
      
      // Calcular valor total
      const valorTotal = result.transactions.reduce((sum, t) => sum + t.amount, 0);

      // Criar fatura
      const { data: fatura, error: faturaError } = await supabase
        .from("credit_card_invoices")
        .insert({
          credit_card_id: cartaoSelecionado,
          competencia,
          mes_referencia: mesReferencia,
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
      const transacoesParaInserir = result.transactions.map((t) => ({
        invoice_id: fatura.id,
        data_transacao: t.date,
        descricao: t.description,
        estabelecimento: t.name,
        valor: t.amount,
        tipo_movimento: t.type,
        tipo: "pontual" as const,
        status: "pendente" as const,
      }));

      const { error: transacoesError } = await supabase
        .from("credit_card_transactions")
        .insert(transacoesParaInserir);

      if (transacoesError) {
        console.error("Erro ao criar transações:", transacoesError);
        toast.error("Erro ao importar transações: " + transacoesError.message);
      } else {
        toast.success(`Fatura importada com sucesso! ${transacoesParaInserir.length} transações criadas.`);
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error("Não foi possível processar o arquivo OFX. Verifique se o arquivo é uma fatura válida.");
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
              Formatos aceitos: .ofx, .qfx (padrão bancário para extratos)
            </p>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview ({preview.length} de {totalTransacoes} transações)
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {preview.map((t, idx) => (
                  <div key={idx} className="text-sm p-2 border rounded bg-background">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{t.description}</p>
                        <p className="text-muted-foreground text-xs">{t.date}</p>
                      </div>
                      <div className="text-right">
                        <p className={t.type === 'debito' ? "text-destructive" : "text-green-600"}>
                          {t.type === 'debito' ? 'Débito' : 'Crédito'}: {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(t.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
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