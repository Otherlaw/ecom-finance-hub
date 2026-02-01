import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface AtualizarCustosSkuModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
}

export function AtualizarCustosSkuModal({ open, onOpenChange, empresaId }: AtualizarCustosSkuModalProps) {
  const queryClient = useQueryClient();
  const [sku, setSku] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [aliquotaImposto, setAliquotaImposto] = useState("");
  const [dataInicio, setDataInicio] = useState<Date>();
  const [dataFim, setDataFim] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const resetForm = () => {
    setSku("");
    setCustoUnitario("");
    setAliquotaImposto("");
    setDataInicio(undefined);
    setDataFim(undefined);
    setPreviewCount(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Buscar quantidade de itens que serão afetados
  const buscarPreview = async () => {
    if (!sku || !dataInicio || !dataFim) {
      toast.error("Preencha o SKU e o período");
      return;
    }

    setIsLoadingPreview(true);
    try {
      // Primeiro buscar as transações do período
      const { data: transacoes } = await supabase
        .from("marketplace_transactions")
        .select("id")
        .eq("empresa_id", empresaId)
        .gte("data_transacao", format(dataInicio, "yyyy-MM-dd"))
        .lte("data_transacao", format(dataFim, "yyyy-MM-dd") + "T23:59:59");

      if (!transacoes || transacoes.length === 0) {
        setPreviewCount(0);
        return;
      }

      const transactionIds = transacoes.map(t => t.id);

      const { count, error } = await supabase
        .from("marketplace_transaction_items")
        .select("id", { count: "exact", head: true })
        .eq("sku_marketplace", sku)
        .in("transaction_id", transactionIds);

      if (error) throw error;
      setPreviewCount(count || 0);
    } catch (error) {
      console.error("Erro ao buscar preview:", error);
      toast.error("Erro ao buscar quantidade de itens");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleAtualizar = async () => {
    if (!sku || !dataInicio || !dataFim) {
      toast.error("Preencha o SKU e o período");
      return;
    }

    const custo = parseFloat(custoUnitario.replace(",", "."));
    const imposto = parseFloat(aliquotaImposto.replace(",", "."));

    if (isNaN(custo) && isNaN(imposto)) {
      toast.error("Informe pelo menos o custo ou a alíquota de imposto");
      return;
    }

    setIsLoading(true);
    try {
      // Primeiro, buscar as transações do período
      const { data: transacoes, error: errTransacoes } = await supabase
        .from("marketplace_transactions")
        .select("id")
        .eq("empresa_id", empresaId)
        .gte("data_transacao", format(dataInicio, "yyyy-MM-dd"))
        .lte("data_transacao", format(dataFim, "yyyy-MM-dd") + "T23:59:59");

      if (errTransacoes) throw errTransacoes;

      if (!transacoes || transacoes.length === 0) {
        toast.warning("Nenhuma transação encontrada no período");
        return;
      }

      const transactionIds = transacoes.map(t => t.id);

      // Buscar itens com o SKU nas transações do período
      const { data: itens, error: errItens } = await supabase
        .from("marketplace_transaction_items")
        .select("id, quantidade, preco_unitario, transaction_id")
        .eq("sku_marketplace", sku)
        .in("transaction_id", transactionIds);

      if (errItens) throw errItens;

      if (!itens || itens.length === 0) {
        toast.warning(`Nenhum item com SKU "${sku}" encontrado no período`);
        return;
      }

      // Atualizar sku_costs para aplicar o custo em novas consultas
      if (!isNaN(custo)) {
        await supabase
          .from("sku_costs")
          .upsert({
            empresa_id: empresaId,
            sku: sku,
            canal: "Mercado Livre",
            custo_unitario: custo,
            descricao: `Atualizado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
            atualizado_em: new Date().toISOString()
          }, {
            onConflict: "empresa_id,sku,canal"
          });
      }

      // Para cada transação afetada, atualizar os valores calculados
      let atualizados = 0;
      for (const item of itens) {
        // Buscar a transação completa
        const { data: transacao } = await supabase
          .from("marketplace_transactions")
          .select("*")
          .eq("id", item.transaction_id)
          .single();

        if (transacao) {
          const quantidade = Number(item.quantidade) || 1;
          const valorBruto = Number(transacao.valor_bruto) || 0;
          
          // Calcular novos valores
          const cmvItem = !isNaN(custo) ? custo * quantidade : 0;
          const impostoItem = !isNaN(imposto) ? (valorBruto * imposto / 100) : 0;
          
          // Atualizar o raw_order com os custos calculados para rastreabilidade
          const rawOrder = transacao.raw_order as Record<string, unknown> || {};
          const updatedRawOrder = {
            ...rawOrder,
            _custos_ajustados: {
              sku,
              custo_unitario: !isNaN(custo) ? custo : null,
              aliquota_imposto: !isNaN(imposto) ? imposto : null,
              cmv_calculado: cmvItem,
              imposto_calculado: impostoItem,
              data_ajuste: new Date().toISOString()
            }
          };

          await supabase
            .from("marketplace_transactions")
            .update({
              raw_order: updatedRawOrder,
              atualizado_em: new Date().toISOString()
            })
            .eq("id", item.transaction_id);

          atualizados++;
        }
      }

      toast.success(`${atualizados} transações atualizadas com sucesso!`);
      
      // Invalidar queries para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido"] });
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["sku-costs"] });
      
      handleClose();
    } catch (error) {
      console.error("Erro ao atualizar custos:", error);
      toast.error("Erro ao atualizar custos das vendas");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Custos de SKU</DialogTitle>
          <DialogDescription>
            Atualize o custo unitário e/ou a alíquota de imposto de um SKU específico para vendas de um período selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* SKU */}
          <div className="space-y-2">
            <Label htmlFor="sku">SKU do Marketplace</Label>
            <Input
              id="sku"
              placeholder="Ex: MLB123456789"
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
                setPreviewCount(null);
              }}
            />
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={(date) => {
                      setDataInicio(date);
                      setPreviewCount(null);
                    }}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={(date) => {
                      setDataFim(date);
                      setPreviewCount(null);
                    }}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Preview */}
          {sku && dataInicio && dataFim && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={buscarPreview}
                disabled={isLoadingPreview}
              >
                {isLoadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Ver quantos itens serão afetados"
                )}
              </Button>
              {previewCount !== null && (
                <span className="text-sm text-muted-foreground">
                  {previewCount} item(s) encontrado(s)
                </span>
              )}
            </div>
          )}

          {/* Custo Unitário */}
          <div className="space-y-2">
            <Label htmlFor="custo">Custo Unitário (R$)</Label>
            <Input
              id="custo"
              placeholder="Ex: 45,90"
              value={custoUnitario}
              onChange={(e) => setCustoUnitario(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para não alterar o custo
            </p>
          </div>

          {/* Alíquota de Imposto */}
          <div className="space-y-2">
            <Label htmlFor="imposto">Alíquota de Imposto (%)</Label>
            <Input
              id="imposto"
              placeholder="Ex: 6"
              value={aliquotaImposto}
              onChange={(e) => setAliquotaImposto(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para não alterar o imposto
            </p>
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Esta ação atualizará os custos de todas as vendas do SKU informado no período selecionado. 
              Os valores anteriores serão substituídos.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleAtualizar} disabled={isLoading || !sku || !dataInicio || !dataFim}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Atualizando...
              </>
            ) : (
              "Atualizar Custos"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
