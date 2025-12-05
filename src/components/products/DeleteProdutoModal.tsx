/**
 * Modal de confirmação de exclusão de produto
 * Com validação de vínculos (estoque, transações, compras)
 */

import { useState, useCallback, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Produto } from "@/lib/motor-custos";

interface DeleteProdutoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto | null;
  onDeleted: () => void;
  onInactivate: () => void;
}

interface VinculosCheck {
  temMovimentacoes: boolean;
  temTransacoesMarketplace: boolean;
  temCMV: boolean;
  qtdMovimentacoes: number;
  qtdTransacoes: number;
  qtdCMV: number;
}

export function DeleteProdutoModal({
  open,
  onOpenChange,
  produto,
  onDeleted,
  onInactivate,
}: DeleteProdutoModalProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [vinculos, setVinculos] = useState<VinculosCheck | null>(null);

  const checkVinculos = useCallback(async () => {
    if (!produto) return;

    setIsChecking(true);
    try {
      // Verificar movimentações de estoque
      const { count: countMov } = await supabase
        .from("movimentacoes_estoque")
        .select("*", { count: "exact", head: true })
        .eq("produto_id", produto.id);

      // Verificar transações de marketplace
      const { count: countTrans } = await supabase
        .from("marketplace_transaction_items")
        .select("*", { count: "exact", head: true })
        .eq("produto_id", produto.id);

      // Verificar registros de CMV
      const { count: countCMV } = await supabase
        .from("cmv_registros")
        .select("*", { count: "exact", head: true })
        .eq("produto_id", produto.id);

      setVinculos({
        temMovimentacoes: (countMov || 0) > 0,
        temTransacoesMarketplace: (countTrans || 0) > 0,
        temCMV: (countCMV || 0) > 0,
        qtdMovimentacoes: countMov || 0,
        qtdTransacoes: countTrans || 0,
        qtdCMV: countCMV || 0,
      });
    } catch (err) {
      console.error("Erro ao verificar vínculos:", err);
      toast.error("Erro ao verificar vínculos do produto");
    } finally {
      setIsChecking(false);
    }
  }, [produto]);

  useEffect(() => {
    if (open && produto) {
      checkVinculos();
    } else {
      setVinculos(null);
    }
  }, [open, produto, checkVinculos]);

  const handleDelete = useCallback(async () => {
    if (!produto) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("produtos")
        .delete()
        .eq("id", produto.id);

      if (error) throw error;

      toast.success("Produto excluído com sucesso");
      onDeleted();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao excluir produto:", err);
      toast.error(`Erro ao excluir: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  }, [produto, onDeleted, onOpenChange]);

  const handleInactivate = useCallback(async () => {
    if (!produto) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("produtos")
        .update({ status: "inativo" })
        .eq("id", produto.id);

      if (error) throw error;

      toast.success("Produto inativado com sucesso");
      onInactivate();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao inativar produto:", err);
      toast.error(`Erro ao inativar: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  }, [produto, onInactivate, onOpenChange]);

  const temVinculos = vinculos && (vinculos.temMovimentacoes || vinculos.temTransacoesMarketplace || vinculos.temCMV);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
          <AlertDialogDescription>
            {isChecking ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando vínculos...
              </div>
            ) : temVinculos ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">
                      Este produto possui vínculos e não pode ser excluído:
                    </div>
                    <ul className="text-sm space-y-1">
                      {vinculos.temMovimentacoes && (
                        <li>• {vinculos.qtdMovimentacoes} movimentações de estoque</li>
                      )}
                      {vinculos.temTransacoesMarketplace && (
                        <li>• {vinculos.qtdTransacoes} transações de marketplace</li>
                      )}
                      {vinculos.temCMV && (
                        <li>• {vinculos.qtdCMV} registros de CMV</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
                <p className="text-sm">
                  Em vez de excluir, você pode <strong>inativar</strong> o produto. 
                  Produtos inativos não aparecem nas buscas, mas mantêm o histórico.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p>
                  Tem certeza que deseja excluir o produto <strong>"{produto?.nome}"</strong>?
                </p>
                <p className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          {temVinculos ? (
            <AlertDialogAction
              onClick={handleInactivate}
              disabled={isDeleting}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Inativar Produto
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || isChecking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir Produto
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
