/**
 * Página de Movimentações Manuais
 * 
 * Permite criar, editar e excluir movimentos manuais que são registrados
 * diretamente no FLOW HUB (movimentos_financeiros com origem='manual').
 */

import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useMovimentosManuais, MovimentoManual } from "@/hooks/useMovimentosManuais";
import { useEmpresas } from "@/hooks/useEmpresas";
import { MovimentoManualFormModal } from "@/components/movimentos-manuais/MovimentoManualFormModal";
import { format, startOfMonth, endOfMonth } from "date-fns";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export default function MovimentosManuais() {
  // Estados de filtros
  const [empresaId, setEmpresaId] = useState<string>("todas");
  const [periodoInicio, setPeriodoInicio] = useState<string>(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [periodoFim, setPeriodoFim] = useState<string>(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [tipoFiltro, setTipoFiltro] = useState<"entrada" | "saida" | "todos">("todos");
  const [searchTerm, setSearchTerm] = useState("");

  // Estados de modal
  const [modalOpen, setModalOpen] = useState(false);
  const [movimentoEditando, setMovimentoEditando] = useState<MovimentoManual | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [movimentoExcluindo, setMovimentoExcluindo] = useState<MovimentoManual | null>(null);

  // Hooks
  const { empresas } = useEmpresas();
  const {
    movimentos,
    resumo,
    isLoading,
    deleteMovimento,
  } = useMovimentosManuais({
    empresaId: empresaId === "todas" ? undefined : empresaId,
    periodoInicio,
    periodoFim,
    tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
  });

  // Filtrar por termo de busca
  const movimentosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return movimentos;
    const termo = searchTerm.toLowerCase();
    return movimentos.filter(
      (m) =>
        m.descricao.toLowerCase().includes(termo) ||
        m.categoriaNome?.toLowerCase().includes(termo) ||
        m.centroCustoNome?.toLowerCase().includes(termo)
    );
  }, [movimentos, searchTerm]);

  // Handlers
  const handleNovoMovimento = () => {
    setMovimentoEditando(null);
    setModalOpen(true);
  };

  const handleEditarMovimento = (movimento: MovimentoManual) => {
    setMovimentoEditando(movimento);
    setModalOpen(true);
  };

  const handleExcluirMovimento = (movimento: MovimentoManual) => {
    setMovimentoExcluindo(movimento);
    setDeleteDialogOpen(true);
  };

  const handleConfirmarExclusao = async () => {
    if (!movimentoExcluindo?.referenciaId) return;
    await deleteMovimento.mutateAsync(movimentoExcluindo.referenciaId);
    setDeleteDialogOpen(false);
    setMovimentoExcluindo(null);
  };

  return (
    <MainLayout 
      title="Movimentações Manuais"
      subtitle="Registre entradas e saídas avulsas diretamente no fluxo de caixa"
      actions={
        <Button onClick={handleNovoMovimento} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Movimentação
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Entradas</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(resumo.totalEntradas)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Saídas</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(resumo.totalSaidas)}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p
                    className={`text-2xl font-bold ${
                      resumo.saldo >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(resumo.saldo)}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Movimentações</p>
                  <p className="text-2xl font-bold">{resumo.quantidade}</p>
                </div>
                <FileText className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Empresa */}
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as empresas</SelectItem>
                  {empresas?.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome_fantasia || empresa.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Período Início */}
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
              />

              {/* Período Fim */}
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
              />

              {/* Tipo */}
              <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>

              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Movimentações */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : movimentosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">
                  Nenhuma movimentação encontrada
                </h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira movimentação manual clicando no botão acima.
                </p>
                <Button onClick={handleNovoMovimento} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Movimentação
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentosFiltrados.map((movimento) => (
                      <TableRow key={movimento.id}>
                        <TableCell className="font-medium">
                          {format(new Date(movimento.data), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          {movimento.tipo === "entrada" ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-600/50 gap-1">
                              <ArrowUpCircle className="h-3 w-3" />
                              Entrada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-600/50 gap-1">
                              <ArrowDownCircle className="h-3 w-3" />
                              Saída
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {movimento.descricao}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movimento.categoriaNome || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movimento.centroCustoNome || "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            movimento.tipo === "entrada" ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {movimento.tipo === "entrada" ? "+" : "-"}
                          {formatCurrency(movimento.valor)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditarMovimento(movimento)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleExcluirMovimento(movimento)}
                              className="text-destructive hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Formulário */}
      <MovimentoManualFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        movimento={movimentoEditando}
      />

      {/* Dialog de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a movimentação{" "}
              <span className="font-medium">"{movimentoExcluindo?.descricao}"</span>?
              <br />
              Esta ação não pode ser desfeita e a movimentação será removida do fluxo de caixa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMovimento.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
