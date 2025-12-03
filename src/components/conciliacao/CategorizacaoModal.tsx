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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Tag, Building2 } from "lucide-react";
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

  const { categorias, categoriasPorTipo, isLoading: loadingCategorias } = useCategoriasFinanceiras();
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
        const { error } = await supabase
          .from("credit_card_transactions")
          .update({
            categoria_id: categoriaId,
            centro_custo_id: centroCustoId || null,
            status: "conciliado", // Marca como conciliado ao categorizar
          })
          .eq("id", transacao.id);

        if (error) throw error;
      }
      // Para transações bancárias, implementar quando houver tabela específica

      toast.success("Transação categorizada com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao categorizar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = loadingCategorias || loadingCentros;

  // Agrupa categorias por tipo para exibição organizada
  const tiposOrdenados = [
    "Receitas",
    "Custos",
    "Despesas Operacionais",
    "Despesas Comercial / Marketing",
    "Despesas Administrativas / Gerais",
    "Despesas com Pessoal",
    "Despesas Financeiras",
    "Impostos Sobre o Resultado",
    "Outras Receitas / Despesas",
  ];

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
                  {tiposOrdenados.map((tipo) => {
                    const cats = categoriasPorTipo[tipo] || [];
                    if (cats.length === 0) return null;
                    return (
                      <SelectGroup key={tipo}>
                        <SelectLabel className="text-xs font-semibold text-primary/70 uppercase tracking-wider">
                          {tipo}
                        </SelectLabel>
                        {cats.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
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
