import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useCartoes } from "@/hooks/useCartoes";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ImportarFaturaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportarFaturaModal({ open, onOpenChange }: ImportarFaturaModalProps) {
  const [loading, setLoading] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const { cartoes } = useCartoes();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);

    // Ler e fazer preview do arquivo
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        setPreview(jsonData.slice(0, 5)); // Mostrar primeiras 5 linhas
        toast.success(`Arquivo carregado: ${jsonData.length} transações encontradas`);
      } catch (error) {
        toast.error("Erro ao ler arquivo. Certifique-se de que é um arquivo Excel válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!arquivo) {
      toast.error("Selecione um arquivo para importar");
      return;
    }

    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

          // Agrupar por cartão e competência
          const faturasPorCartao = new Map<string, any>();

          for (const row of jsonData) {
            const cnpj = String(row.CNPJ || row.cnpj || "").replace(/\D/g, "");
            const ultimos4 = String(row.ultimos_4_digitos || row.cartao || "").slice(-4);
            const competencia = row.competencia || row.mes_ano || "";
            const chave = `${cnpj}-${ultimos4}-${competencia}`;

            if (!faturasPorCartao.has(chave)) {
              faturasPorCartao.set(chave, {
                cnpj,
                ultimos4,
                competencia,
                transacoes: [],
              });
            }

            faturasPorCartao.get(chave)!.transacoes.push({
              data_transacao: row.data || row.data_compra,
              data_lancamento: row.data_lancamento,
              descricao: row.descricao || row.estabelecimento,
              estabelecimento: row.estabelecimento,
              valor: parseFloat(String(row.valor || 0).replace(/[^\d,-]/g, "").replace(",", ".")),
              numero_parcela: row.parcela || row.numero_parcela,
              total_parcelas: row.total_parcelas,
              tipo: row.tipo || "pontual",
            });
          }

          // Criar faturas e transações
          let faturasImportadas = 0;
          let transacoesImportadas = 0;

          for (const [, faturaData] of faturasPorCartao) {
            // Buscar cartão pelo CNPJ e últimos 4 dígitos
            const { data: cartao } = await supabase
              .from("credit_cards")
              .select("id, empresa:empresas!inner(cnpj)")
              .eq("empresas.cnpj", faturaData.cnpj)
              .ilike("ultimos_digitos", `%${faturaData.ultimos4}`)
              .single();

            if (!cartao) {
              console.warn(`Cartão não encontrado: CNPJ ${faturaData.cnpj}, últimos 4: ${faturaData.ultimos4}`);
              continue;
            }

            // Criar fatura
            const valorTotal = faturaData.transacoes.reduce((sum: number, t: any) => sum + t.valor, 0);
            const { data: fatura, error: faturaError } = await supabase
              .from("credit_card_invoices")
              .insert({
                credit_card_id: cartao.id,
                competencia: faturaData.competencia,
                mes_referencia: faturaData.competencia + "-01",
                data_fechamento: faturaData.competencia + "-01",
                data_vencimento: faturaData.competencia + "-01",
                valor_total: valorTotal,
                status: "pendente",
              })
              .select()
              .single();

            if (faturaError) {
              console.error("Erro ao criar fatura:", faturaError);
              continue;
            }

            faturasImportadas++;

            // Criar transações
            const transacoesParaInserir = faturaData.transacoes.map((t: any) => ({
              invoice_id: fatura.id,
              data_transacao: t.data_transacao,
              data_lancamento: t.data_lancamento,
              descricao: t.descricao,
              estabelecimento: t.estabelecimento,
              valor: t.valor,
              numero_parcela: t.numero_parcela,
              total_parcelas: t.total_parcelas,
              tipo: t.tipo,
              status: "pendente",
            }));

            const { error: transacoesError } = await supabase
              .from("credit_card_transactions")
              .insert(transacoesParaInserir);

            if (!transacoesError) {
              transacoesImportadas += transacoesParaInserir.length;
            }
          }

          toast.success(
            `Importação concluída! ${faturasImportadas} faturas e ${transacoesImportadas} transações importadas.`
          );
          onOpenChange(false);
        } catch (error: any) {
          console.error("Erro na importação:", error);
          toast.error("Erro ao processar arquivo: " + error.message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(arquivo);
    } catch (error: any) {
      toast.error("Erro ao importar: " + error.message);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Faturas de Cartão</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo Excel (XLSX) com as transações das faturas. O sistema irá agrupar automaticamente
            por cartão e competência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Arquivo de Faturas</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Formato esperado: CNPJ, ultimos_4_digitos, competencia, data, descricao, estabelecimento, valor, parcela
            </p>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Preview (primeiras 5 linhas)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(preview[0] || {}).map((key) => (
                        <th key={key} className="text-left p-2">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b">
                        {Object.values(row).map((value: any, vidx) => (
                          <td key={vidx} className="p-2">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={loading || !arquivo}>
            {loading ? "Importando..." : "Importar Faturas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}