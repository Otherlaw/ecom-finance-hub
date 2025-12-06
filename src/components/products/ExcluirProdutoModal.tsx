import { useState } from "react";
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
import { AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExcluirProdutoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string | null;
  produtoNome: string;
  onSuccess?: () => void;
}

export function ExcluirProdutoModal({
  open,
  onOpenChange,
  produtoId,
  produtoNome,
  onSuccess,
}: ExcluirProdutoModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [vinculoError, setVinculoError] = useState<string | null>(null);

  const verificarVinculos = async (id: string): Promise<string | null> => {
    // Verificar movimentações de estoque
    const { count: movEstoque } = await supabase
      .from("movimentacoes_estoque")
      .select("*", { count: "exact", head: true })
      .eq("produto_id", id);

    if (movEstoque && movEstoque > 0) {
      return `Este produto possui ${movEstoque} movimentação(ões) de estoque. Em vez de excluir, marque como inativo.`;
    }

    // Verificar itens de transação marketplace
    const { count: mktItems } = await supabase
      .from("marketplace_transaction_items")
      .select("*", { count: "exact", head: true })
      .eq("produto_id", id);

    if (mktItems && mktItems > 0) {
      return `Este produto está vinculado a ${mktItems} transação(ões) de marketplace. Em vez de excluir, marque como inativo.`;
    }

    // Verificar itens de compra
    const { count: compraItems } = await supabase
      .from("compras_itens")
      .select("*", { count: "exact", head: true })
      .eq("produto_id", id);

    if (compraItems && compraItems > 0) {
      return `Este produto está vinculado a ${compraItems} item(ns) de compra. Em vez de excluir, marque como inativo.`;
    }

    // Verificar registros CMV
    const { count: cmvCount } = await supabase
      .from("cmv_registros")
      .select("*", { count: "exact", head: true })
      .eq("produto_id", id);

    if (cmvCount && cmvCount > 0) {
      return `Este produto possui ${cmvCount} registro(s) de CMV. Em vez de excluir, marque como inativo.`;
    }

    // Verificar estoque
    const { count: estoqueCount } = await supabase
      .from("estoque")
      .select("*", { count: "exact", head: true })
      .eq("produto_id", id);

    if (estoqueCount && estoqueCount > 0) {
      return `Este produto possui ${estoqueCount} registro(s) de estoque. Em vez de excluir, marque como inativo.`;
    }

    // Verificar variações (filhos)
    const { count: variacoesCount } = await supabase
      .from("produtos")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", id);

    if (variacoesCount && variacoesCount > 0) {
      return `Este produto possui ${variacoesCount} variação(ões) vinculada(s). Exclua as variações primeiro ou marque como inativo.`;
    }

    return null;
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setVinculoError(null);
    }
    onOpenChange(open);
  };

  const handleDelete = async () => {
    if (!produtoId) return;

    setIsDeleting(true);
    setVinculoError(null);

    try {
      const vinculo = await verificarVinculos(produtoId);
      if (vinculo) {
        setVinculoError(vinculo);
        setIsDeleting(false);
        return;
      }

      const { error } = await supabase
        .from("produtos")
        .delete()
        .eq("id", produtoId);

      if (error) throw error;

      toast.success("Produto excluído com sucesso");
      handleOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Erro ao excluir produto:", err);
      toast.error(`Erro ao excluir: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Excluir Produto
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o produto <strong>"{produtoNome}"</strong>?
            <br /><br />
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {vinculoError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{vinculoError}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
