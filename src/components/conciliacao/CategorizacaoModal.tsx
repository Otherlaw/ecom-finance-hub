import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Tag, Building2 } from "lucide-react";
import { registrarMovimentoFinanceiro, excluirMovimentoPorReferencia } from "@/hooks/useMovimentosFinanceiros";
import { formatCurrency } from "@/lib/mock-data";

interface CategorizacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacao: {
    id: string;
    descricao: string;
    valor: number;
    data?: string;
    estabelecimento?: string | null;
    categoria_id?: string | null;
    centro_custo_id?: string | null;
  } | null;
  tipo: "cartao" | "bancaria";
  onSuccess?: () => void;
}

export function CategorizacaoModal({
  open,
  onOpenChange,
  transacao,
  tipo,
  onSuccess,
}: CategorizacaoModalProps) {
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const { categoriasPorTipo, isLoading: loadingCategorias } = useCategoriasFinanceiras();
  const { centrosFlat, isLoading: loadingCentros } = useCentrosCusto();

  // Carrega valores atuais quando a transação muda
  useEffect(() => {
    if (transacao) {
      setCategoriaId(transacao.categoria_id || "");
      setCentroCustoId(transacao.centro_custo_id || "");
    }
  }, [transacao]);

  const handleSave = async () => {
    if (!transacao) return;

    if (!categoriaId) {
      toast.error("Selecione uma categoria financeira");
      return;
    }

    setIsSaving(true);
    try {
      if (tipo === "cartao") {
        // Atualizar transação de cartão
        const { error } = await supabase
          .from("credit_card_transactions")
          .update({
            categoria_id: categoriaId,
            centro_custo_id: centroCustoId || null,
            status: "conciliado",
          })
          .eq("id", transacao.id);

        if (error) throw error;

        // Buscar dados completos da transação para registrar no MEU
        const { data: txCompleta } = await supabase
          .from("credit_card_transactions")
          .select(`
            id,
            data_transacao,
            descricao,
            estabelecimento,
            valor,
            categoria:categorias_financeiras(id, nome),
            centro_custo:centros_de_custo(id, nome),
            fatura:credit_card_invoices(
              cartao:credit_cards(
                id,
                empresa_id,
                responsavel_id
              )
            )
          `)
          .eq("id", transacao.id)
          .single();

        // Registrar movimento no MEU
        if (txCompleta) {
          const empresaId = (txCompleta.fatura as any)?.cartao?.empresa_id;
          const categoriaSelecionada = categoriasPorTipo
            .flatMap(g => g.categorias)
            .find(c => c.id === categoriaId);
          const centroCustoSelecionado = centrosFlat.find(c => c.id === centroCustoId);

          if (empresaId) {
            await registrarMovimentoFinanceiro({
              data: txCompleta.data_transacao,
              tipo: "saida",
              origem: "cartao",
              descricao: txCompleta.descricao || txCompleta.estabelecimento || "Transação de cartão",
              valor: Math.abs(txCompleta.valor),
              empresa_id: empresaId,
              referencia_id: txCompleta.id,
              categoria_id: categoriaId,
              categoria_nome: categoriaSelecionada?.nome || null,
              centro_custo_id: centroCustoId || undefined,
              centro_custo_nome: centroCustoSelecionado?.nome || undefined,
              responsavel_id: (txCompleta.fatura as any)?.cartao?.responsavel_id || undefined,
              forma_pagamento: "Cartão de crédito",
              fornecedor_nome: txCompleta.estabelecimento || undefined,
              observacoes: "Transação de cartão conciliada",
            });
          }
        }

        toast.success("Transação categorizada com sucesso!");
      } else if (tipo === "bancaria") {
        // Transações bancárias ainda usam mock data
        // TODO: Implementar tabela bank_transactions quando necessário
        toast.info("Categorização bancária registrada (em desenvolvimento)");
      }
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao categorizar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = loadingCategorias || loadingCentros;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Categorizar Transação
          </DialogTitle>
        </DialogHeader>

        {transacao && (
          <div className="space-y-6">
            {/* Resumo da transação */}
            <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{transacao.descricao}</p>
                  {transacao.estabelecimento && (
                    <p className="text-sm text-muted-foreground">{transacao.estabelecimento}</p>
                  )}
                </div>
                <span className="font-bold text-lg">
                  {formatCurrency(transacao.valor)}
                </span>
              </div>
              {transacao.data && (
                <p className="text-xs text-muted-foreground">
                  Data: {new Date(transacao.data).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>

            {/* Categoria Financeira */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Categoria Financeira *
              </Label>
              <Select value={categoriaId} onValueChange={setCategoriaId} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {categoriasPorTipo.map((grupo) => (
                    <div key={grupo.tipo}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                        {grupo.tipo}
                      </div>
                      {grupo.categorias.filter(c => c.ativo).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Centro de Custo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Centro de Custo
              </Label>
              <Select 
                value={centroCustoId || "none"} 
                onValueChange={(val) => setCentroCustoId(val === "none" ? "" : val)} 
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o centro de custo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {centrosFlat
                    .filter((c) => c.ativo)
                    .map((centro) => (
                      <SelectItem key={centro.id} value={centro.id}>
                        <span style={{ paddingLeft: `${centro.level * 12}px` }}>
                          {centro.codigo ? `[${centro.codigo}] ` : ""}
                          {centro.nome}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !categoriaId}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
