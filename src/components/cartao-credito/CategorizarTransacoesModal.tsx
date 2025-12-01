import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTransacoes } from "@/hooks/useCartoes";
import { useQuery } from "@tanstack/react-query";

interface CategorizarTransacoesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faturaId: string;
}

export function CategorizarTransacoesModal({ open, onOpenChange, faturaId }: CategorizarTransacoesModalProps) {
  const { transacoes, isLoading, updateTransacao } = useTransacoes(faturaId);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("");
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string>("");
  const [responsavelSelecionado, setResponsavelSelecionado] = useState<string>("");

  const { data: categorias } = useQuery({
    queryKey: ["categorias_financeiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: centrosCusto } = useQuery({
    queryKey: ["centros_de_custo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_de_custo")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: responsaveis } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const toggleSelecao = (id: string) => {
    const novaSelecao = new Set(selecionadas);
    if (novaSelecao.has(id)) {
      novaSelecao.delete(id);
    } else {
      novaSelecao.add(id);
    }
    setSelecionadas(novaSelecao);
  };

  const selecionarTodas = () => {
    if (selecionadas.size === transacoes?.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(transacoes?.map((t) => t.id) || []));
    }
  };

  const aplicarCategorizacao = async () => {
    if (selecionadas.size === 0) {
      toast.error("Selecione ao menos uma transação");
      return;
    }

    if (!categoriaSelecionada) {
      toast.error("Selecione uma categoria");
      return;
    }

    try {
      const promises = Array.from(selecionadas).map((id) =>
        updateTransacao.mutateAsync({
          id,
          categoria_id: categoriaSelecionada || null,
          centro_custo_id: centroCustoSelecionado || null,
          responsavel_id: responsavelSelecionado || null,
          status: "conciliado",
        })
      );

      await Promise.all(promises);
      toast.success(`${selecionadas.size} transações categorizadas com sucesso!`);
      setSelecionadas(new Set());
      setCategoriaSelecionada("");
      setCentroCustoSelecionado("");
      setResponsavelSelecionado("");
    } catch (error: any) {
      toast.error("Erro ao categorizar: " + error.message);
    }
  };

  const aprovarIndividual = async (id: string) => {
    const transacao = transacoes?.find((t) => t.id === id);
    if (!transacao?.categoria_id) {
      toast.error("Defina uma categoria antes de aprovar");
      return;
    }

    try {
      await updateTransacao.mutateAsync({
        id,
        status: "conciliado",
      });
    } catch (error: any) {
      toast.error("Erro ao aprovar: " + error.message);
    }
  };

  const rejeitarIndividual = async (id: string) => {
    try {
      await updateTransacao.mutateAsync({
        id,
        status: "reprovado",
      });
      toast.success("Transação reprovada");
    } catch (error: any) {
      toast.error("Erro ao rejeitar: " + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Categorizar Transações</DialogTitle>
          <DialogDescription>
            Categorize as transações da fatura para integração com DRE e análises financeiras
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
            <div>
              <Label>Categoria Financeira</Label>
              <Select value={categoriaSelecionada} onValueChange={setCategoriaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Centro de Custo</Label>
              <Select value={centroCustoSelecionado} onValueChange={setCentroCustoSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {centrosCusto?.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Responsável</Label>
              <Select value={responsavelSelecionado} onValueChange={setResponsavelSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis?.map((resp) => (
                    <SelectItem key={resp.id} value={resp.id}>
                      {resp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-3 flex gap-2">
              <Button onClick={aplicarCategorizacao} disabled={selecionadas.size === 0}>
                Aplicar às Selecionadas ({selecionadas.size})
              </Button>
              <Button variant="outline" onClick={() => setSelecionadas(new Set())}>
                Limpar Seleção
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selecionadas.size === transacoes?.length && transacoes?.length > 0}
                    onCheckedChange={selecionarTodas}
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Centro Custo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {transacoes?.map((transacao) => (
                <TableRow key={transacao.id}>
                  <TableCell>
                    <Checkbox
                      checked={selecionadas.has(transacao.id)}
                      onCheckedChange={() => toggleSelecao(transacao.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(transacao.data_transacao).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>{transacao.estabelecimento || "-"}</TableCell>
                  <TableCell>{transacao.descricao}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(transacao.valor)}
                  </TableCell>
                  <TableCell>{transacao.categoria?.nome || "-"}</TableCell>
                  <TableCell>{transacao.centro_custo?.nome || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        transacao.status === "conciliado"
                          ? "default"
                          : transacao.status === "reprovado"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {transacao.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {transacao.status !== "conciliado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => aprovarIndividual(transacao.id)}
                          disabled={!transacao.categoria_id}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {transacao.status !== "reprovado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rejeitarIndividual(transacao.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}