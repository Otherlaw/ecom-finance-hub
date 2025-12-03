import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Sparkles, Lightbulb, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTransacoes } from "@/hooks/useCartoes";
import { useRegrasCategorizacao } from "@/hooks/useRegrasCategorizacao";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface CategorizarTransacoesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faturaId: string;
}

export function CategorizarTransacoesModal({ open, onOpenChange, faturaId }: CategorizarTransacoesModalProps) {
  const { transacoes, isLoading, updateTransacao } = useTransacoes(faturaId);
  const { getSugestoes, aprenderCategorizacao, incrementarUso } = useRegrasCategorizacao();
  
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("");
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string>("");
  const [responsavelSelecionado, setResponsavelSelecionado] = useState<string>("");
  const [aprenderAutomatico, setAprenderAutomatico] = useState(true);

  const { data: categorias } = useQuery({
    queryKey: ["categorias_financeiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .eq("ativo", true)
        .order("tipo")
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

  // Calcula sugestões para transações sem categoria
  const sugestoes = useMemo(() => {
    if (!transacoes?.length) return new Map();
    
    const pendentes = transacoes
      .filter((t) => !t.categoria_id && t.estabelecimento)
      .map((t) => ({ id: t.id, estabelecimento: t.estabelecimento }));
    
    return getSugestoes(pendentes);
  }, [transacoes, getSugestoes]);

  const transacoesComSugestao = transacoes?.filter((t) => sugestoes.has(t.id)).length || 0;

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
      const transacoesParaAtualizar = transacoes?.filter((t) => selecionadas.has(t.id)) || [];
      
      const promises = transacoesParaAtualizar.map(async (t) => {
        await updateTransacao.mutateAsync({
          id: t.id,
          categoria_id: categoriaSelecionada || null,
          centro_custo_id: centroCustoSelecionado || null,
          responsavel_id: responsavelSelecionado || null,
          status: "conciliado",
        });

        // Aprende com a categorização se habilitado
        if (aprenderAutomatico && t.estabelecimento) {
          await aprenderCategorizacao.mutateAsync({
            estabelecimento: t.estabelecimento,
            categoria_id: categoriaSelecionada || null,
            centro_custo_id: centroCustoSelecionado || null,
            responsavel_id: responsavelSelecionado || null,
          });
        }
      });

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

  // Aplica sugestões automáticas a todas as transações com sugestão
  const aplicarSugestoesAutomaticas = async () => {
    if (sugestoes.size === 0) {
      toast.error("Nenhuma sugestão disponível");
      return;
    }

    try {
      const promises = Array.from(sugestoes.entries()).map(async ([transacaoId, sugestao]) => {
        await updateTransacao.mutateAsync({
          id: transacaoId,
          categoria_id: sugestao.categoria_id,
          centro_custo_id: sugestao.centro_custo_id,
          responsavel_id: sugestao.responsavel_id,
          status: "conciliado",
        });

        // Incrementa uso da regra
        await incrementarUso.mutateAsync(sugestao.regra_id);
      });

      await Promise.all(promises);
      toast.success(`${sugestoes.size} transações categorizadas automaticamente!`);
    } catch (error: any) {
      toast.error("Erro ao aplicar sugestões: " + error.message);
    }
  };

  // Aplica sugestão individual
  const aplicarSugestao = async (transacaoId: string) => {
    const sugestao = sugestoes.get(transacaoId);
    if (!sugestao) return;

    try {
      await updateTransacao.mutateAsync({
        id: transacaoId,
        categoria_id: sugestao.categoria_id,
        centro_custo_id: sugestao.centro_custo_id,
        responsavel_id: sugestao.responsavel_id,
        status: "conciliado",
      });

      await incrementarUso.mutateAsync(sugestao.regra_id);
      toast.success("Sugestão aplicada!");
    } catch (error: any) {
      toast.error("Erro ao aplicar sugestão: " + error.message);
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

  const getNomeCategoria = (id: string | null) => {
    if (!id) return null;
    return categorias?.find((c) => c.id === id)?.nome;
  };

  const getNomeCentroCusto = (id: string | null) => {
    if (!id) return null;
    return centrosCusto?.find((c) => c.id === id)?.nome;
  };

  // Agrupa categorias por tipo para o select
  const categoriasPorTipo = useMemo(() => {
    if (!categorias) return {};
    return categorias.reduce((acc, cat) => {
      if (!acc[cat.tipo]) acc[cat.tipo] = [];
      acc[cat.tipo].push(cat);
      return acc;
    }, {} as Record<string, typeof categorias>);
  }, [categorias]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Categorizar Transações
            {transacoesComSugestao > 0 && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 gap-1">
                <Sparkles className="h-3 w-3" />
                {transacoesComSugestao} sugestões
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Categorize as transações da fatura para integração com DRE e análises financeiras
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Banner de sugestões automáticas */}
          {transacoesComSugestao > 0 && (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-500/5 border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {transacoesComSugestao} transações com sugestões baseadas no histórico
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O sistema identificou padrões de categorização anteriores
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={aplicarSugestoesAutomaticas}
                className="gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
              >
                <Zap className="h-4 w-4" />
                Aplicar Todas
              </Button>
            </div>
          )}

          {/* Categorização em lote */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
            <div>
              <Label>Categoria Financeira</Label>
              <Select value={categoriaSelecionada} onValueChange={setCategoriaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Object.entries(categoriasPorTipo).map(([tipo, cats]) => (
                    <div key={tipo}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                        {tipo}
                      </div>
                      {cats.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </div>
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

            <div className="flex flex-col justify-end">
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  id="aprender-auto"
                  checked={aprenderAutomatico}
                  onCheckedChange={setAprenderAutomatico}
                />
                <Label htmlFor="aprender-auto" className="text-xs cursor-pointer">
                  Memorizar para próximas vezes
                </Label>
              </div>
            </div>

            <div className="col-span-1 md:col-span-4 flex gap-2">
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
              {transacoes?.map((transacao) => {
                const sugestao = sugestoes.get(transacao.id);
                const temSugestao = !!sugestao && !transacao.categoria_id;

                return (
                  <TableRow
                    key={transacao.id}
                    className={cn(temSugestao && "bg-amber-500/5")}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selecionadas.has(transacao.id)}
                        onCheckedChange={() => toggleSelecao(transacao.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(transacao.data_transacao).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {transacao.estabelecimento || "-"}
                        {temSugestao && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Sparkles className="h-4 w-4 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Sugestão disponível</p>
                                <p className="text-xs text-muted-foreground">
                                  Categoria: {getNomeCategoria(sugestao.categoria_id) || "—"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Confiança: {sugestao.confianca}%
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{transacao.descricao}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(transacao.valor)}
                    </TableCell>
                    <TableCell>
                      {transacao.categoria?.nome || (
                        temSugestao ? (
                          <span className="text-amber-600 text-xs italic">
                            Sugestão: {getNomeCategoria(sugestao.categoria_id)}
                          </span>
                        ) : "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {transacao.centro_custo?.nome || (
                        temSugestao && sugestao.centro_custo_id ? (
                          <span className="text-amber-600 text-xs italic">
                            Sugestão: {getNomeCentroCusto(sugestao.centro_custo_id)}
                          </span>
                        ) : "-"
                      )}
                    </TableCell>
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
                        {temSugestao && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => aplicarSugestao(transacao.id)}
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                >
                                  <Sparkles className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Aplicar sugestão</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
