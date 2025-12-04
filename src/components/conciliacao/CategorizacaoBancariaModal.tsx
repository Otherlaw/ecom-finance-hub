import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import { BankTransaction, useBankTransactions } from "@/hooks/useBankTransactions";
import { formatCurrency } from "@/lib/mock-data";
import { Check, X, RotateCcw, Tag, Building2, User } from "lucide-react";

interface CategorizacaoBancariaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacao: BankTransaction | null;
  onSuccess?: () => void;
}

export function CategorizacaoBancariaModal({
  open,
  onOpenChange,
  transacao,
  onSuccess,
}: CategorizacaoBancariaModalProps) {
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");

  const { categorias, isLoading: loadingCategorias } = useCategoriasFinanceiras();
  const { centrosCusto, isLoading: loadingCentros } = useCentrosCusto();
  const { responsaveis, isLoading: loadingResponsaveis } = useResponsaveis();
  const { atualizarTransacao, conciliarTransacao, ignorarTransacao, reabrirTransacao } = useBankTransactions();

  useEffect(() => {
    if (transacao) {
      setCategoriaId(transacao.categoria_id || "");
      setCentroCustoId(transacao.centro_custo_id || "");
      setResponsavelId(transacao.responsavel_id || "");
    }
  }, [transacao]);

  if (!transacao) return null;

  const handleSalvar = () => {
    atualizarTransacao.mutate(
      {
        id: transacao.id,
        categoria_id: categoriaId || null,
        centro_custo_id: centroCustoId || null,
        responsavel_id: responsavelId || null,
      },
      {
        onSuccess: () => {
          onSuccess?.();
          onOpenChange(false);
        },
      }
    );
  };

  const handleConciliar = () => {
    if (!categoriaId) {
      return;
    }

    const transacaoAtualizada = {
      ...transacao,
      categoria_id: categoriaId,
      centro_custo_id: centroCustoId || null,
      responsavel_id: responsavelId || null,
    };

    conciliarTransacao.mutate(transacaoAtualizada, {
      onSuccess: () => {
        onSuccess?.();
        onOpenChange(false);
      },
    });
  };

  const handleIgnorar = () => {
    ignorarTransacao.mutate(transacao.id, {
      onSuccess: () => {
        onSuccess?.();
        onOpenChange(false);
      },
    });
  };

  const handleReabrir = () => {
    reabrirTransacao.mutate(transacao, {
      onSuccess: () => {
        onSuccess?.();
        onOpenChange(false);
      },
    });
  };

  const isConciliado = transacao.status === "conciliado";
  const isIgnorado = transacao.status === "ignorado";
  const isPending = 
    atualizarTransacao.isPending || 
    conciliarTransacao.isPending || 
    ignorarTransacao.isPending || 
    reabrirTransacao.isPending;

  // Agrupar categorias por tipo
  const categoriasPorTipo = categorias?.reduce((acc, cat) => {
    if (!acc[cat.tipo]) acc[cat.tipo] = [];
    acc[cat.tipo].push(cat);
    return acc;
  }, {} as Record<string, typeof categorias>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {isConciliado ? "Transação Conciliada" : isIgnorado ? "Transação Ignorada" : "Categorizar Transação"}
          </DialogTitle>
          <DialogDescription>
            {isConciliado 
              ? "Esta transação já foi conciliada e registrada no fluxo de caixa"
              : isIgnorado
              ? "Esta transação foi marcada como ignorada"
              : "Defina a categoria e centro de custo para esta transação bancária"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Detalhes da transação */}
          <div className="p-4 rounded-lg bg-secondary/30 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{transacao.descricao}</p>
                {transacao.documento && (
                  <p className="text-xs text-muted-foreground">Doc: {transacao.documento}</p>
                )}
              </div>
              <Badge variant={transacao.tipo_lancamento === "credito" ? "default" : "destructive"}>
                {transacao.tipo_lancamento === "credito" ? "Crédito" : "Débito"}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(transacao.data_transacao).toLocaleDateString("pt-BR")}
              </span>
              <span className={`font-bold ${
                transacao.tipo_lancamento === "credito" ? "text-success" : "text-destructive"
              }`}>
                {transacao.tipo_lancamento === "credito" ? "+" : "-"}{formatCurrency(transacao.valor)}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                Status: {transacao.status.charAt(0).toUpperCase() + transacao.status.slice(1)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {transacao.origem_extrato === "arquivo_ofx" ? "OFX" : 
                 transacao.origem_extrato === "arquivo_csv" ? "CSV" : "Manual"}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Campos de categorização */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Categoria Financeira {!isConciliado && !isIgnorado && "*"}
              </Label>
              <Select 
                value={categoriaId} 
                onValueChange={setCategoriaId}
                disabled={isConciliado || isIgnorado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasPorTipo && Object.entries(categoriasPorTipo).map(([tipo, cats]) => (
                    <div key={tipo}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {tipo}
                      </div>
                      {cats?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Centro de Custo
              </Label>
              <Select 
                value={centroCustoId} 
                onValueChange={setCentroCustoId}
                disabled={isConciliado || isIgnorado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um centro de custo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {centrosCusto?.filter((c) => c.ativo).map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.codigo ? `${cc.codigo} - ` : ""}{cc.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável
              </Label>
              <Select 
                value={responsavelId} 
                onValueChange={setResponsavelId}
                disabled={isConciliado || isIgnorado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um responsável (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {responsaveis?.filter((r) => r.ativo).map((resp) => (
                    <SelectItem key={resp.id} value={resp.id}>
                      {resp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {(isConciliado || isIgnorado) ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleReabrir}
                disabled={isPending}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reabrir Transação
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={handleIgnorar}
                disabled={isPending}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Ignorar
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleSalvar}
                disabled={isPending}
              >
                Salvar como Pendente
              </Button>
              <Button 
                onClick={handleConciliar}
                disabled={isPending || !categoriaId}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Conciliar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
