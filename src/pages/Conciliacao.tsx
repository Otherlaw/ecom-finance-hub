import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/mock-data";
import { RefreshCw, Upload, Download, Check, AlertTriangle, X, FileSpreadsheet, Search, Filter, Building, CreditCard, ShoppingBag, PenLine, Eye, Tag, RotateCcw, Ban, Store, CalendarIcon, Trash2, Copy, Wand2, ListTodo, Sparkles } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFaturas, useTransacoes } from "@/hooks/useCartoes";
import { useBankTransactions, BankTransaction } from "@/hooks/useBankTransactions";
import { useMovimentacoesManuais, ManualTransaction } from "@/hooks/useManualTransactions";
import { useMarketplaceTransactions, MarketplaceTransaction, DuplicateGroup } from "@/hooks/useMarketplaceTransactions";
import { useMarketplaceAutoCategorizacao } from "@/hooks/useMarketplaceAutoCategorizacao";
import { useBankAutoCategorizacao } from "@/hooks/useBankAutoCategorizacao";
import { useCreditCardAutoCategorizacao } from "@/hooks/useCreditCardAutoCategorizacao";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { CategorizacaoModal } from "@/components/conciliacao/CategorizacaoModal";
import { CategorizacaoBancariaModal } from "@/components/conciliacao/CategorizacaoBancariaModal";
import { ImportarExtratoBancarioModal } from "@/components/conciliacao/ImportarExtratoBancarioModal";
import { ImportarMarketplaceModal } from "@/components/conciliacao/ImportarMarketplaceModal";
import { CategorizacaoMarketplaceModal } from "@/components/conciliacao/CategorizacaoMarketplaceModal";
import { MarketplaceImportJobsPanel } from "@/components/conciliacao/MarketplaceImportJobsPanel";
import { useMarketplaceImportJobs } from "@/hooks/useMarketplaceImportJobs";
import { MovimentoManualFormModal } from "@/components/movimentos-manuais/MovimentoManualFormModal";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// Mock removido - usando dados reais de manual_transactions

function calculateTotals(data: any[], statusField = "status") {
  return {
    registros: data.length,
    conciliados: data.filter(c => c[statusField] === "ok" || c[statusField] === "aprovado" || c[statusField] === "conciliado").length,
    divergencias: data.filter(c => c[statusField] === "divergencia").length,
    pendentes: data.filter(c => c[statusField] === "faltando" || c[statusField] === "pendente").length,
    totalDiferencas: data.reduce((acc, c) => acc + (c.diferenca || 0), 0)
  };
}
function StatusBadge({
  status
}: {
  status: string;
}) {
  if (status === "ok" || status === "aprovado" || status === "conciliado") {
    return <Badge className="bg-success/10 text-success border-success/20">
        <Check className="h-3 w-3 mr-1" />
        {status === "aprovado" ? "Aprovado" : status === "conciliado" ? "Conciliado" : "OK"}
      </Badge>;
  }
  if (status === "categorizado") {
    return <Badge className="bg-primary/10 text-primary border-primary/20">
        <Wand2 className="h-3 w-3 mr-1" />
        Auto
      </Badge>;
  }
  if (status === "divergencia") {
    return <Badge className="bg-warning/10 text-warning border-warning/20">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Divergência
      </Badge>;
  }
  if (status === "faltando" || status === "pendente" || status === "importado") {
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">
        <X className="h-3 w-3 mr-1" />
        {status === "pendente" ? "Pendente" : status === "importado" ? "Importado" : "Faltando"}
      </Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
function SummaryCards({
  totals
}: {
  totals: ReturnType<typeof calculateTotals>;
}) {
  return <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-secondary">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Total</span>
        </div>
        <p className="text-2xl font-bold">{totals.registros}</p>
      </div>

      <div className="p-5 rounded-xl bg-success/5 border border-success/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-success/10">
            <Check className="h-4 w-4 text-success" />
          </div>
          <span className="text-sm text-muted-foreground">Conciliados</span>
        </div>
        <p className="text-2xl font-bold text-success">{totals.conciliados}</p>
        <p className="text-xs text-muted-foreground">
          {totals.registros > 0 ? (totals.conciliados / totals.registros * 100).toFixed(0) : 0}%
        </p>
      </div>

      <div className="p-5 rounded-xl bg-warning/5 border border-warning/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <span className="text-sm text-muted-foreground">Divergências</span>
        </div>
        <p className="text-2xl font-bold text-warning">{totals.divergencias}</p>
      </div>

      <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-destructive/10">
            <X className="h-4 w-4 text-destructive" />
          </div>
          <span className="text-sm text-muted-foreground">Pendentes</span>
        </div>
        <p className="text-2xl font-bold text-destructive">{totals.pendentes}</p>
        {totals.totalDiferencas > 0 && <p className="text-xs text-muted-foreground">{formatCurrency(totals.totalDiferencas)}</p>}
      </div>
    </div>;
}
function ProgressBar({
  totals
}: {
  totals: ReturnType<typeof calculateTotals>;
}) {
  const progress = totals.registros > 0 ? totals.conciliados / totals.registros * 100 : 0;
  return <div className="mb-6 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Progresso da Conciliação</span>
        <span className="text-sm text-muted-foreground">
          {totals.conciliados} de {totals.registros} registros
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>;
}
function FilterBar({
  showExport = true
}: {
  showExport?: boolean;
}) {
  return <div className="flex items-center gap-4 mb-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por descrição..." className="pl-10" />
      </div>
      <Button variant="outline" className="gap-2">
        <Filter className="h-4 w-4" />
        Filtrar
      </Button>
      {showExport && <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>}
    </div>;
}

// Tab content components
function BancariaTab() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [categorizacaoModal, setCategorizacaoModal] = useState<{
    open: boolean;
    transacao: BankTransaction | null;
  }>({
    open: false,
    transacao: null
  });

  // Filtros
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  // Período selecionável (padrão: mês atual)
  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  
  const periodoInicio = format(new Date(anoSelecionado, mesSelecionado, 1), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(new Date(anoSelecionado, mesSelecionado, 1)), "yyyy-MM-dd");
  
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - 2 + i);
  const {
    empresas
  } = useEmpresas();
  const {
    categorizarAutomaticamente: categorizarBancario,
    isProcessing: isAutoProcessingBank
  } = useBankAutoCategorizacao();
  const {
    transacoes,
    resumo,
    isLoading,
    refetch
  } = useBankTransactions({
    empresaId: empresaId === "all" ? undefined : empresaId,
    periodoInicio,
    periodoFim,
    status: statusFiltro
  });

  const handleAutoCategorizarBank = async () => {
    await categorizarBancario.mutateAsync({
      empresaId: empresaId !== "all" ? empresaId : undefined
    });
    refetch();
  };

  // Filtro de busca local
  const transacoesFiltradas = transacoes.filter(t => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return t.descricao.toLowerCase().includes(termo) || t.documento?.toLowerCase().includes(termo);
  });
  const totals = {
    registros: transacoesFiltradas.length,
    conciliados: resumo.conciliadas,
    divergencias: 0,
    pendentes: resumo.importadas + resumo.pendentes,
    totalDiferencas: 0
  };
  const handleCategorizar = (transacao: BankTransaction) => {
    setCategorizacaoModal({
      open: true,
      transacao
    });
  };
  const handleCategorizacaoSuccess = () => {
    refetch();
  };
  if (isLoading) {
    return <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>;
  }
  return <div>
      {/* Summary Cards customizado para banco */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-secondary">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Total</span>
          </div>
          <p className="text-2xl font-bold">{resumo.total}</p>
        </div>

        <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Importadas</span>
          </div>
          <p className="text-2xl font-bold text-primary">{resumo.importadas}</p>
        </div>

        <div className="p-5 rounded-xl bg-warning/5 border border-warning/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <span className="text-sm text-muted-foreground">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-warning">{resumo.pendentes}</p>
        </div>

        <div className="p-5 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-success/10">
              <Check className="h-4 w-4 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">Conciliadas</span>
          </div>
          <p className="text-2xl font-bold text-success">{resumo.conciliadas}</p>
        </div>

        <div className="p-5 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-muted">
              <Ban className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Ignoradas</span>
          </div>
          <p className="text-2xl font-bold text-muted-foreground">{resumo.ignoradas}</p>
        </div>
      </div>

      {/* Progress */}
      {resumo.total > 0 && <div className="mb-6 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso da Conciliação</span>
            <span className="text-sm text-muted-foreground">
              {resumo.conciliadas} de {resumo.total} registros
            </span>
          </div>
          <Progress value={resumo.conciliadas / resumo.total * 100} className="h-2" />
        </div>}
      
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Seletor de Período */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <Select value={mesSelecionado.toString()} onValueChange={(v) => setMesSelecionado(parseInt(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {meses.map((mes, i) => (
                <SelectItem key={i} value={i.toString()}>{mes}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anoSelecionado.toString()} onValueChange={(v) => setAnoSelecionado(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((ano) => (
                <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição..." className="pl-10" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {empresas?.map(emp => <SelectItem key={emp.id} value={emp.id}>
                {emp.nome_fantasia || emp.razao_social}
              </SelectItem>)}
          </SelectContent>
        </Select>
        
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="importado">Importados</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="conciliado">Conciliados</SelectItem>
            <SelectItem value="ignorado">Ignorados</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
        
        <Button 
          variant="secondary" 
          className="gap-2" 
          onClick={handleAutoCategorizarBank}
          disabled={isAutoProcessingBank}
        >
          <Sparkles className="h-4 w-4" />
          {isAutoProcessingBank ? "Processando..." : "Categorizar Auto"}
        </Button>
        
        <Button className="gap-2 ml-auto" onClick={() => setImportModalOpen(true)}>
          <Upload className="h-4 w-4" />
          Importar Extrato
        </Button>
      </div>
      
      <ModuleCard title="Conciliação Bancária" description="Transações importadas de extratos" icon={Building} noPadding>
        {transacoesFiltradas.length === 0 ? <div className="p-8 text-center text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhuma transação bancária encontrada</p>
            <p className="text-sm mt-1">Importe um extrato bancário para iniciar a conciliação</p>
            <Button className="mt-4 gap-2" onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar Extrato
            </Button>
          </div> : <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Centro Custo</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transacoesFiltradas.map(t => <TableRow key={t.id} className={t.status === "conciliado" ? "bg-success/5" : t.status === "ignorado" ? "bg-muted/30 opacity-60" : t.status === "pendente" ? "bg-warning/5" : ""}>
                  <TableCell className="font-medium">
                    {new Date(t.data_transacao).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{t.descricao}</span>
                      {t.documento && <p className="text-xs text-muted-foreground">Doc: {t.documento}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.categoria ? <Badge variant="outline" className="bg-success/5 border-success/30 text-success">
                        {t.categoria.nome}
                      </Badge> : <Badge variant="outline" className="text-muted-foreground">
                        Não categorizado
                      </Badge>}
                  </TableCell>
                  <TableCell>
                    {t.centro_custo ? <Badge variant="secondary">{t.centro_custo.nome}</Badge> : <span className="text-muted-foreground text-sm">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={t.tipo_lancamento === "credito" 
                        ? "bg-success/10 text-success border-success/30" 
                        : "bg-destructive/10 text-destructive border-destructive/30"
                      }
                    >
                      {t.tipo_lancamento === "credito" ? "Crédito" : "Débito"}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${t.tipo_lancamento === "credito" ? "text-success" : "text-destructive"}`}>
                    {t.tipo_lancamento === "credito" ? "+" : "-"}{formatCurrency(t.valor)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleCategorizar(t)}>
                      {t.status === "conciliado" ? <>
                          <Eye className="h-3 w-3" />
                          Ver
                        </> : t.status === "ignorado" ? <>
                          <RotateCcw className="h-3 w-3" />
                          Reabrir
                        </> : <>
                          <Tag className="h-3 w-3" />
                          Categorizar
                        </>}
                    </Button>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>}
      </ModuleCard>
      
      {/* Modal de Importação */}
      <ImportarExtratoBancarioModal open={importModalOpen} onOpenChange={setImportModalOpen} onSuccess={handleCategorizacaoSuccess} />
      
      {/* Modal de Categorização */}
      <CategorizacaoBancariaModal open={categorizacaoModal.open} onOpenChange={open => setCategorizacaoModal({
      ...categorizacaoModal,
      open
    })} transacao={categorizacaoModal.transacao} onSuccess={handleCategorizacaoSuccess} />
    </div>;
}
function CartoesTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    transacoes,
    isLoading: loadingTransacoes,
    refetch
  } = useTransacoes();
  const {
    faturas,
    isLoading: loadingFaturas
  } = useFaturas();
  const {
    categorizarAutomaticamente: categorizarCartao,
    isProcessing: isAutoProcessingCard
  } = useCreditCardAutoCategorizacao();

  const handleAutoCategorizarCard = async () => {
    await categorizarCartao.mutateAsync({});
    refetch();
  };

  // Estado do modal de categorização
  const [categorizacaoModal, setCategorizacaoModal] = useState<{
    open: boolean;
    transacao: any | null;
  }>({
    open: false,
    transacao: null
  });

  // Transform real data for conciliation view
  const conciliacaoData = (transacoes || []).map((t: any) => {
    const valorCategorizado = t.categoria_id ? t.valor : 0;
    const diferenca = t.categoria_id ? 0 : t.valor;
    let status = "pendente";
    if (t.status === "conciliado") status = "conciliado";else if (t.status === "aprovado") status = "ok";else if (t.categoria_id && t.centro_custo_id) status = "ok";else if (t.categoria_id || t.centro_custo_id) status = "divergencia";
    return {
      id: t.id,
      data: new Date(t.data_transacao).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit"
      }),
      data_transacao: t.data_transacao,
      descricao: t.descricao,
      estabelecimento: t.estabelecimento,
      valorFatura: t.valor,
      valor: t.valor,
      valorCategorizado,
      diferenca: diferenca > 0 ? diferenca : 0,
      status,
      cartao: t.fatura?.credit_card_id ? `Fatura ${t.fatura?.mes_referencia?.substring(0, 7)}` : "N/A",
      categoria: t.categoria?.nome || null,
      categoria_id: t.categoria_id,
      centroCusto: t.centro_custo?.nome || null,
      centro_custo_id: t.centro_custo_id,
      faturaId: t.invoice_id
    };
  });
  const totals = calculateTotals(conciliacaoData);
  const isLoading = loadingTransacoes || loadingFaturas;
  const handleCategorizar = (item: any) => {
    setCategorizacaoModal({
      open: true,
      transacao: {
        id: item.id,
        descricao: item.descricao,
        valor: item.valor,
        data: item.data_transacao,
        estabelecimento: item.estabelecimento,
        categoria_id: item.categoria_id,
        centro_custo_id: item.centro_custo_id
      }
    });
  };
  const handleCategorizacaoSuccess = () => {
    refetch();
    queryClient.invalidateQueries({
      queryKey: ["dre-transacoes"]
    });
  };
  if (isLoading) {
    return <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>;
  }
  return <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição ou estabelecimento..." className="pl-10" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
        <Button 
          variant="secondary" 
          className="gap-2" 
          onClick={handleAutoCategorizarCard}
          disabled={isAutoProcessingCard}
        >
          <Sparkles className="h-4 w-4" />
          {isAutoProcessingCard ? "Processando..." : "Categorizar Auto"}
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => navigate("/cartao-credito")}>
          <Eye className="h-4 w-4" />
          Ver Módulo Completo
        </Button>
      </div>
      
      <ModuleCard title="Conciliação de Cartões" description="Transações vs Categorizadas" icon={CreditCard} noPadding>
        {conciliacaoData.length === 0 ? <div className="p-8 text-center text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhuma transação encontrada</p>
            <p className="text-sm mt-1">Importe faturas de cartão para iniciar a conciliação</p>
            <Button className="mt-4" onClick={() => navigate("/cartao-credito")}>
              Ir para Cartões de Crédito
            </Button>
          </div> : <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="w-[80px]">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Centro Custo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conciliacaoData.slice(0, 20).map((item: any) => <TableRow key={item.id} className={item.status !== "ok" && item.status !== "conciliado" ? "bg-warning/5" : ""}>
                  <TableCell className="font-medium">{item.data}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{item.descricao}</span>
                      {item.estabelecimento && <p className="text-xs text-muted-foreground">{item.estabelecimento}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.categoria ? <Badge variant="outline" className="bg-success/5 border-success/30 text-success">
                        {item.categoria}
                      </Badge> : <Badge variant="outline" className="text-muted-foreground">
                        Não categorizado
                      </Badge>}
                  </TableCell>
                  <TableCell>
                    {item.centroCusto ? <Badge variant="secondary">{item.centroCusto}</Badge> : <span className="text-muted-foreground text-sm">-</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.valorFatura)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleCategorizar(item)}>
                      <Tag className="h-3 w-3" />
                      {item.status === "ok" || item.status === "conciliado" ? "Editar" : "Categorizar"}
                    </Button>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>}
        
        {conciliacaoData.length > 20 && <div className="p-4 border-t border-border text-center">
            <Button variant="link" onClick={() => navigate("/cartao-credito")}>
              Ver todas as {conciliacaoData.length} transações
            </Button>
          </div>}
      </ModuleCard>
      
      {/* Modal de Categorização */}
      <CategorizacaoModal open={categorizacaoModal.open} onOpenChange={open => setCategorizacaoModal({
      ...categorizacaoModal,
      open
    })} transacao={categorizacaoModal.transacao} tipo="cartao" onSuccess={handleCategorizacaoSuccess} />
    </div>;
}
function MarketplaceTab() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [categorizacaoModal, setCategorizacaoModal] = useState<{
    open: boolean;
    transacao: MarketplaceTransaction | null;
  }>({
    open: false,
    transacao: null
  });
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Filtros
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [canal, setCanal] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(100);

  // Filtro de período opcional
  const [periodoAtivo, setPeriodoAtivo] = useState(false);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dataFim, setDataFim] = useState<Date | undefined>(endOfMonth(new Date()));
  const [atalhoSelecionado, setAtalhoSelecionado] = useState<string | null>(null);
  const {
    empresas
  } = useEmpresas();
  const {
    reprocessarAntigas,
    isProcessing: isAutoProcessing
  } = useMarketplaceAutoCategorizacao();
  const {
    transacoes,
    resumo,
    isLoading,
    refetch,
    duplicatas,
    isDuplicatesLoading,
    excluirDuplicatas
  } = useMarketplaceTransactions({
    empresaId: empresaId === "all" ? undefined : empresaId,
    canal: canal === "all" ? undefined : canal,
    status: statusFiltro as any,
    periodoInicio: periodoAtivo && dataInicio ? format(dataInicio, "yyyy-MM-dd") : undefined,
    periodoFim: periodoAtivo && dataFim ? format(dataFim, "yyyy-MM-dd") : undefined
  });

  // Total de transações duplicadas
  const totalDuplicatas = duplicatas.reduce((acc, g) => acc + g.count - 1, 0); // -1 porque mantemos 1 de cada grupo

  // Filtro de busca local
  const transacoesFiltradas = transacoes.filter(t => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return t.descricao.toLowerCase().includes(termo) || t.pedido_id?.toLowerCase().includes(termo) || t.canal.toLowerCase().includes(termo);
  });

  // Paginação das transações filtradas
  const totalPaginas = Math.ceil(transacoesFiltradas.length / itensPorPagina);
  const transacoesPaginadas = transacoesFiltradas.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

  // Reset página ao mudar filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [empresaId, canal, statusFiltro, busca, periodoAtivo, dataInicio, dataFim]);
  const handleCategorizar = (transacao: MarketplaceTransaction) => {
    setCategorizacaoModal({
      open: true,
      transacao
    });
  };
  const handleReprocessarAntigas = async () => {
    setIsReprocessing(true);
    try {
      await reprocessarAntigas.mutateAsync({
        empresaId: empresaId !== "all" ? empresaId : undefined
      });
      refetch();
    } catch (err) {
      console.error("Erro ao reprocessar:", err);
    } finally {
      setIsReprocessing(false);
    }
  };
  const CANAL_LABELS: Record<string, string> = {
    mercado_livre: "Mercado Livre",
    shopee: "Shopee",
    amazon: "Amazon",
    tiktok: "TikTok Shop",
    shein: "Shein",
    outro: "Outro"
  };
  const getCanalBadgeClass = (canalValue: string) => {
    switch (canalValue) {
      case "mercado_livre":
        return "border-yellow-500 text-yellow-600";
      case "shopee":
        return "border-orange-500 text-orange-600";
      case "tiktok":
        return "border-pink-500 text-pink-600";
      case "shein":
        return "border-purple-500 text-purple-600";
      case "amazon":
        return "border-amber-500 text-amber-600";
      default:
        return "border-gray-500 text-gray-600";
    }
  };
  if (isLoading) {
    return <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>;
  }
  return <div>
      {/* Painel de Importações em Andamento */}
      <MarketplaceImportJobsPanel empresaId={empresaId === "all" ? undefined : empresaId} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-secondary">
              <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-xl font-bold">{resumo.total}</p>
        </div>

        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Upload className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Importados</span>
          </div>
          <p className="text-xl font-bold text-primary">{resumo.importadas}</p>
        </div>

        <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-warning/10">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            </div>
            <span className="text-xs text-muted-foreground">Pendentes</span>
          </div>
          <p className="text-xl font-bold text-warning">{resumo.pendentes}</p>
        </div>

        <div className="p-4 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-success/10">
              <Check className="h-3.5 w-3.5 text-success" />
            </div>
            <span className="text-xs text-muted-foreground">Conciliados</span>
          </div>
          <p className="text-xl font-bold text-success">{resumo.conciliadas}</p>
        </div>

        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-muted">
              <Ban className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">Ignorados</span>
          </div>
          <p className="text-xl font-bold text-muted-foreground">{resumo.ignoradas}</p>
        </div>

        {/* Novo card: Tarifas do Período */}
        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-destructive/10">
              <CreditCard className="h-3.5 w-3.5 text-destructive" />
            </div>
            <span className="text-xs text-muted-foreground">Tarifas/Taxas</span>
          </div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(resumo.totalDescontos)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Tar: {formatCurrency(resumo.totalTarifas)} | Tax: {formatCurrency(resumo.totalTaxas)}
          </p>
        </div>

        {/* Novo card: % Tarifas sobre Vendas Líquidas (Créditos) */}
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-xs text-muted-foreground">% Tarifas</span>
          </div>
          <p className="text-xl font-bold text-amber-600">
            {(() => {
              // Calcular % de tarifas sobre vendas líquidas (créditos)
              // Só exibir percentual se houver vendas (créditos) conciliadas ou totais
              const vendasLiquidas = resumo.totalCreditos;
              const totalTarifas = resumo.totalDescontos;
              
              if (vendasLiquidas <= 0) {
                return "—"; // Sem vendas = não calcular
              }
              
              const percentual = (totalTarifas / vendasLiquidas) * 100;
              return percentual.toFixed(1) + "%";
            })()}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {resumo.totalCreditos > 0 
              ? `sobre ${formatCurrency(resumo.totalCreditos)} em vendas`
              : "sem vendas no período"
            }
          </p>
        </div>
      </div>

      {/* Progress */}
      {resumo.total > 0 && <div className="mb-6 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso da Conciliação</span>
            <span className="text-sm text-muted-foreground">
              {resumo.conciliadas} de {resumo.total} registros
            </span>
          </div>
          <Progress value={resumo.conciliadas / resumo.total * 100} className="h-2" />
        </div>}
      
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição ou pedido..." className="pl-10" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {empresas?.map(emp => <SelectItem key={emp.id} value={emp.id}>
                {emp.nome_fantasia || emp.razao_social}
              </SelectItem>)}
          </SelectContent>
        </Select>
        
        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Todos os canais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
            <SelectItem value="shopee">Shopee</SelectItem>
            <SelectItem value="amazon">Amazon</SelectItem>
            <SelectItem value="tiktok">TikTok Shop</SelectItem>
            <SelectItem value="shein">Shein</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="importado">Importados</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="conciliado">Conciliados</SelectItem>
            <SelectItem value="ignorado">Ignorados</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Filtro de Período Opcional */}
        <div className="flex items-center gap-2">
          <Checkbox id="periodo-ativo" checked={periodoAtivo} onCheckedChange={checked => setPeriodoAtivo(checked === true)} />
          <label htmlFor="periodo-ativo" className="text-sm text-muted-foreground cursor-pointer">
            Período
          </label>
          {periodoAtivo && <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => {
          setPeriodoAtivo(false);
          setAtalhoSelecionado(null);
        }}>
              Limpar
            </Button>}
        </div>
        
        {periodoAtivo && <div className="flex items-center gap-2 flex-wrap">
            {/* Atalhos de período */}
            <div className="flex gap-1">
              <Button variant={atalhoSelecionado === "7dias" ? "default" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => {
            setDataInicio(subDays(new Date(), 7));
            setDataFim(new Date());
            setAtalhoSelecionado("7dias");
          }}>
                7 dias
              </Button>
              <Button variant={atalhoSelecionado === "30dias" ? "default" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => {
            setDataInicio(subDays(new Date(), 30));
            setDataFim(new Date());
            setAtalhoSelecionado("30dias");
          }}>
                30 dias
              </Button>
              <Button variant={atalhoSelecionado === "mesAtual" ? "default" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => {
            setDataInicio(startOfMonth(new Date()));
            setDataFim(endOfMonth(new Date()));
            setAtalhoSelecionado("mesAtual");
          }}>
                Mês atual
              </Button>
              <Button variant={atalhoSelecionado === "mesAnterior" ? "default" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => {
            const mesAnterior = subMonths(new Date(), 1);
            setDataInicio(startOfMonth(mesAnterior));
            setDataFim(endOfMonth(mesAnterior));
            setAtalhoSelecionado("mesAnterior");
          }}>
                Mês anterior
              </Button>
            </div>
            
            {/* Seletores de data */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={date => {
              setDataInicio(date);
              setAtalhoSelecionado(null);
            }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={date => {
              setDataFim(date);
              setAtalhoSelecionado(null);
            }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>}
        
        <Button variant="outline" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
        
        {/* Contador de transações */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground ml-2">
          <span className="font-medium text-foreground">{transacoesFiltradas.length}</span>
          <span>de {transacoes.length} transações</span>
        </div>
        
        {/* Botão de Duplicatas */}
        {totalDuplicatas > 0 && <Button variant="outline" className="gap-2 border-warning text-warning hover:bg-warning/10" onClick={() => setDuplicatesModalOpen(true)}>
            <Copy className="h-4 w-4" />
            {totalDuplicatas} Duplicatas
          </Button>}
        
        {/* Botão de Reprocessamento Automático */}
        {(resumo.importadas > 0 || resumo.pendentes > 0) && <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10" onClick={handleReprocessarAntigas} disabled={isReprocessing || isAutoProcessing}>
            <Wand2 className={cn("h-4 w-4", (isReprocessing || isAutoProcessing) && "animate-spin")} />
            {isReprocessing || isAutoProcessing ? "Processando..." : "Reprocessar Automático"}
          </Button>}
        
        <Button className={cn("gap-2", totalDuplicatas === 0 && resumo.importadas === 0 && resumo.pendentes === 0 && "ml-auto")} onClick={() => setImportModalOpen(true)}>
          <Upload className="h-4 w-4" />
          Importar Relatório
        </Button>
      </div>
      
      <ModuleCard title="Conciliação de Marketplace" description="Transações de vendas e taxas" icon={Store} noPadding>
        {transacoesFiltradas.length === 0 ? <div className="p-8 text-center text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhuma transação de marketplace encontrada</p>
            <p className="text-sm mt-1">Importe um relatório CSV do marketplace para iniciar a conciliação</p>
            <Button className="mt-4 gap-2" onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar Relatório
            </Button>
          </div> : <>
            <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="w-[90px]">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead className="text-right">Tarifas</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transacoesPaginadas.map(t => {
              const totalTarifas = (t.tarifas || 0) + (t.taxas || 0) + (t.outros_descontos || 0);
              return <TableRow key={t.id} className={t.status === "conciliado" ? "bg-success/5" : t.status === "ignorado" ? "bg-muted/30 opacity-60" : t.status === "pendente" ? "bg-warning/5" : ""}>
                    <TableCell className="font-medium">
                      {new Date(t.data_transacao).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{t.descricao}</span>
                        <p className="text-xs text-muted-foreground">{t.tipo_transacao}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={getCanalBadgeClass(t.canal)}>
                          {CANAL_LABELS[t.canal] || t.canal}
                        </Badge>
                        {t.canal_venda && t.canal_venda !== t.canal && <span className="text-[10px] text-muted-foreground">{t.canal_venda}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.pedido_id || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {totalTarifas > 0 ? <div className="group relative">
                          <span className="text-destructive font-medium text-sm cursor-help">
                            {formatCurrency(totalTarifas)}
                          </span>
                          <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block bg-popover border border-border rounded-md shadow-lg p-2 text-xs whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Tarifas:</span>
                                <span>{formatCurrency(t.tarifas || 0)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Taxas:</span>
                                <span>{formatCurrency(t.taxas || 0)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Outros:</span>
                                <span>{formatCurrency(t.outros_descontos || 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div> : <span className="text-muted-foreground text-sm">-</span>}
                    </TableCell>
                    <TableCell>
                      {t.categoria ? <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="bg-success/5 border-success/30 text-success">
                            {t.categoria.nome}
                          </Badge>
                          {t.status === "conciliado" && <span className="text-[10px] text-primary flex items-center gap-0.5">
                              <Wand2 className="h-2.5 w-2.5" />
                              Auto
                            </span>}
                        </div> : <Badge variant="outline" className="text-muted-foreground">
                          Não categorizado
                        </Badge>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={t.tipo_lancamento === "credito" ? "default" : "destructive"}>
                        {t.tipo_lancamento === "credito" ? "Crédito" : "Débito"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${t.tipo_lancamento === "credito" ? "text-success" : "text-destructive"}`}>
                      {t.tipo_lancamento === "credito" ? "+" : "-"}{formatCurrency(t.valor_liquido)}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleCategorizar(t)}>
                        {t.status === "conciliado" ? <>
                            <Eye className="h-3 w-3" />
                            Ver
                          </> : t.status === "ignorado" ? <>
                            <RotateCcw className="h-3 w-3" />
                            Reabrir
                          </> : <>
                            <Tag className="h-3 w-3" />
                            Categorizar
                          </>}
                      </Button>
                    </TableCell>
                  </TableRow>;
            })}
            </TableBody>
          </Table>
          
          {/* Paginação */}
          {totalPaginas > 1 && <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {(paginaAtual - 1) * itensPorPagina + 1} a {Math.min(paginaAtual * itensPorPagina, transacoesFiltradas.length)} de {transacoesFiltradas.length}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Itens:</span>
                  <Select value={String(itensPorPagina)} onValueChange={val => {
                setItensPorPagina(Number(val));
                setPaginaAtual(1);
              }}>
                    <SelectTrigger className="w-[80px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="250">250</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPaginaAtual(1)} disabled={paginaAtual === 1}>
                  Primeira
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1}>
                  Anterior
                </Button>
                <span className="text-sm px-3">
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas}>
                  Próxima
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPaginaAtual(totalPaginas)} disabled={paginaAtual === totalPaginas}>
                  Última
                </Button>
              </div>
            </div>}
          </>}
      </ModuleCard>
      
      {/* Modal de Importação */}
      <ImportarMarketplaceModal open={importModalOpen} onOpenChange={setImportModalOpen} onSuccess={() => refetch()} />
      
      {/* Modal de Categorização */}
      <CategorizacaoMarketplaceModal open={categorizacaoModal.open} onOpenChange={open => setCategorizacaoModal({
      ...categorizacaoModal,
      open
    })} transaction={categorizacaoModal.transacao} onSuccess={() => refetch()} />
      
      {/* Modal de Duplicatas */}
      <Dialog open={duplicatesModalOpen} onOpenChange={setDuplicatesModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-warning" />
              Transações Duplicadas
            </DialogTitle>
            <DialogDescription>
              Foram encontradas {duplicatas.length} grupo(s) com transações duplicadas ({totalDuplicatas} duplicatas no total).
              Selecione as transações que deseja remover. A primeira de cada grupo é mantida por padrão.
            </DialogDescription>
          </DialogHeader>
          
          {/* Ações rápidas */}
          {duplicatas.length > 0 && <div className="flex items-center gap-2 py-2 border-b">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => {
            const allDuplicateIds = duplicatas.flatMap(g => g.transactions.slice(1).map(t => t.id));
            setSelectedDuplicates(new Set(allDuplicateIds));
          }}>
                <Checkbox className="h-3.5 w-3.5" checked={selectedDuplicates.size === totalDuplicatas} />
                Selecionar todas ({totalDuplicatas})
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2" disabled={excluirDuplicatas.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                    {excluirDuplicatas.isPending ? "Removendo..." : `Remover todas (${totalDuplicatas})`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar remoção em massa</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você está prestes a remover <strong>{totalDuplicatas} transações duplicadas</strong>. 
                      Esta ação não pode ser desfeita. A primeira transação de cada grupo será mantida.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
                  const allDuplicateIds = duplicatas.flatMap(g => g.transactions.slice(1).map(t => t.id));
                  if (allDuplicateIds.length === 0) return;
                  excluirDuplicatas.mutate(allDuplicateIds, {
                    onSuccess: () => {
                      setSelectedDuplicates(new Set());
                      setDuplicatesModalOpen(false);
                    }
                  });
                }}>
                      Sim, remover todas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {selectedDuplicates.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelectedDuplicates(new Set())}>
                  Limpar seleção
                </Button>}
            </div>}
          
          <ScrollArea className="max-h-[50vh] pr-4">
            {isDuplicatesLoading ? <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div> : duplicatas.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                <Check className="h-12 w-12 mx-auto mb-4 text-success" />
                <p className="font-medium">Nenhuma duplicata encontrada</p>
                <p className="text-sm">Todas as transações são únicas.</p>
              </div> : <div className="space-y-6">
                {duplicatas.map(grupo => <div key={grupo.hash} className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                          {grupo.count} transações iguais
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {grupo.transactions[0]?.canal} • {grupo.transactions[0]?.data_transacao}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                  const idsToSelect = grupo.transactions.slice(1).map(t => t.id);
                  setSelectedDuplicates(prev => {
                    const newSet = new Set(prev);
                    idsToSelect.forEach(id => newSet.add(id));
                    return newSet;
                  });
                }}>
                        Selecionar duplicatas
                      </Button>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-8"></TableHead>
                          <TableHead className="w-20">Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right w-24">Valor</TableHead>
                          <TableHead className="w-20">Status</TableHead>
                          <TableHead className="w-32">Criado em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grupo.transactions.map((t, idx) => <TableRow key={t.id} className={cn(idx === 0 && "bg-success/5", selectedDuplicates.has(t.id) && "bg-destructive/10")}>
                            <TableCell>
                              {idx === 0 ? <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success">
                                  Original
                                </Badge> : <Checkbox checked={selectedDuplicates.has(t.id)} onCheckedChange={checked => {
                        setSelectedDuplicates(prev => {
                          const newSet = new Set(prev);
                          if (checked) {
                            newSet.add(t.id);
                          } else {
                            newSet.delete(t.id);
                          }
                          return newSet;
                        });
                      }} />}
                            </TableCell>
                            <TableCell className="text-xs">{t.data_transacao}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{t.descricao}</TableCell>
                            <TableCell className="text-xs text-right font-medium">
                              {formatCurrency(t.valor_liquido)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {t.criado_em ? format(new Date(t.criado_em), "dd/MM HH:mm") : "-"}
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>
                  </div>)}
              </div>}
          </ScrollArea>
          
          <DialogFooter className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedDuplicates.size > 0 && <span>{selectedDuplicates.size} transação(ões) selecionada(s) para remoção</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
              setDuplicatesModalOpen(false);
              setSelectedDuplicates(new Set());
            }}>
                Cancelar
              </Button>
              <Button variant="destructive" className="gap-2" disabled={selectedDuplicates.size === 0 || excluirDuplicatas.isPending} onClick={() => {
              if (selectedDuplicates.size === 0) return;
              excluirDuplicatas.mutate(Array.from(selectedDuplicates), {
                onSuccess: () => {
                  setSelectedDuplicates(new Set());
                  setDuplicatesModalOpen(false);
                }
              });
            }}>
                <Trash2 className="h-4 w-4" />
                {excluirDuplicatas.isPending ? "Removendo..." : `Remover ${selectedDuplicates.size} Duplicata(s)`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}

// Nova aba: Processamento de Importações
function ImportacoesTab() {
  const { emAndamento, historico, isLoading, refetch } = useMarketplaceImportJobs();
  
  // Polling a cada 5 segundos para atualização em tempo real
  React.useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const formatarData = (dataStr: string) => {
    return new Date(dataStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processando":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case "concluido":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <Check className="h-3 w-3 mr-1" />
            Concluído
          </Badge>
        );
      case "erro":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <X className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const todosJobs = [...emAndamento, ...historico].slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-secondary">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Total Jobs</span>
          </div>
          <p className="text-2xl font-bold">{todosJobs.length}</p>
        </div>

        <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <RefreshCw className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm text-muted-foreground">Em Processamento</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{emAndamento.length}</p>
        </div>

        <div className="p-5 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-success/10">
              <Check className="h-4 w-4 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">Concluídos</span>
          </div>
          <p className="text-2xl font-bold text-success">
            {historico.filter(j => j.status === "concluido").length}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-destructive/10">
              <X className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-sm text-muted-foreground">Com Erro</span>
          </div>
          <p className="text-2xl font-bold text-destructive">
            {historico.filter(j => j.status === "erro").length}
          </p>
        </div>
      </div>

      {/* Tabela de jobs */}
      <ModuleCard
        title="Processamento de Importações"
        description="Histórico dos últimos 20 jobs de importação de marketplace"
        icon={ListTodo}
        noPadding
      >
        {todosJobs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhuma importação encontrada</p>
            <p className="text-sm mt-1">Importe um relatório de marketplace para ver o histórico</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead>Arquivo</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Progresso</TableHead>
                <TableHead className="text-right">Novas</TableHead>
                <TableHead className="text-right">Duplicadas</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todosJobs.map((job) => {
                const progresso = job.total_linhas > 0 
                  ? Math.round((job.linhas_processadas / job.total_linhas) * 100)
                  : 0;
                
                return (
                  <TableRow key={job.id} className={job.status === "processando" ? "bg-blue-500/5" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]" title={job.arquivo_nome}>
                          {job.arquivo_nome}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {job.canal.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatarData(job.criado_em)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(job.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progresso} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-10">
                          {progresso}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-success">
                      {job.linhas_importadas.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-600">
                      {job.linhas_duplicadas.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {job.linhas_processadas.toLocaleString()} / {job.total_linhas.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ModuleCard>
    </div>
  );
}

function ManualTab() {
  const queryClient = useQueryClient();
  const [modalManualOpen, setModalManualOpen] = useState(false);
  const [movimentoEdicao, setMovimentoEdicao] = useState<ManualTransaction | null>(null);
  const [busca, setBusca] = useState("");

  // Hook com dados reais e mutations de aprovação/rejeição
  const {
    movimentacoes,
    resumo,
    isLoading,
    refetch,
    aprovarLancamento,
    rejeitarLancamento,
    reabrirLancamento
  } = useMovimentacoesManuais();

  // Filtro de busca local
  const movimentacoesFiltradas = movimentacoes.filter(m => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return m.descricao.toLowerCase().includes(termo) || m.responsavel?.nome?.toLowerCase().includes(termo);
  });

  // Totals para SummaryCards
  const totals = {
    registros: movimentacoesFiltradas.length,
    conciliados: resumo.aprovados,
    divergencias: 0,
    pendentes: resumo.pendentes,
    totalDiferencas: 0
  };
  const handleNovoLancamento = () => {
    setMovimentoEdicao(null);
    setModalManualOpen(true);
  };
  const handleEditarLancamento = (movimento: ManualTransaction) => {
    setMovimentoEdicao(movimento);
    setModalManualOpen(true);
  };
  const handleAprovar = (lancamento: ManualTransaction) => {
    aprovarLancamento.mutate(lancamento);
  };
  const handleRejeitar = (lancamento: ManualTransaction) => {
    rejeitarLancamento.mutate(lancamento);
  };
  const handleReabrir = (lancamento: ManualTransaction) => {
    reabrirLancamento.mutate(lancamento);
  };
  if (isLoading) {
    return <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>;
  }
  return <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição..." className="pl-10" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
        <Button className="gap-2" onClick={handleNovoLancamento}>
          <PenLine className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>
      
      <ModuleCard title="Lançamentos Manuais" description="Ajustes e correções manuais" icon={PenLine} noPadding>
        {movimentacoesFiltradas.length === 0 ? <div className="p-8 text-center text-muted-foreground">
            <PenLine className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhum lançamento manual encontrado</p>
            <p className="text-sm mt-1">Crie um novo lançamento para iniciar</p>
            <Button className="mt-4 gap-2" onClick={handleNovoLancamento}>
              <PenLine className="h-4 w-4" />
              Novo Lançamento
            </Button>
          </div> : <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentacoesFiltradas.map(item => <TableRow key={item.id} className={item.status === "pendente" ? "bg-warning/5" : item.status === "aprovado" ? "bg-success/5" : item.status === "rejeitado" ? "bg-muted/30 opacity-60" : ""}>
                  <TableCell className="font-medium">
                    {new Date(item.data).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{item.descricao}</span>
                      {item.observacoes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {item.observacoes}
                        </p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.categoria ? <Badge variant="outline" className="bg-primary/5 border-primary/30">
                        {item.categoria.nome}
                      </Badge> : <span className="text-muted-foreground text-sm">-</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={item.tipo === "entrada" ? "border-success text-success" : "border-destructive text-destructive"}>
                      {item.tipo === "entrada" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.responsavel?.nome || "-"}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${item.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                    {item.tipo === "entrada" ? "+" : "-"}{formatCurrency(item.valor)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {item.status === "pendente" && <div className="flex gap-1 justify-center">
                        <Button variant="ghost" size="sm" className="text-success hover:text-success hover:bg-success/10" onClick={() => handleAprovar(item)} disabled={aprovarLancamento.isPending}>
                          {aprovarLancamento.isPending ? "..." : "Aprovar"}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRejeitar(item)} disabled={rejeitarLancamento.isPending}>
                          {rejeitarLancamento.isPending ? "..." : "Rejeitar"}
                        </Button>
                      </div>}
                    {item.status === "aprovado" && <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => handleReabrir(item)} disabled={reabrirLancamento.isPending}>
                        <RotateCcw className="h-3 w-3" />
                        {reabrirLancamento.isPending ? "..." : "Reabrir"}
                      </Button>}
                    {item.status === "rejeitado" && <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => handleReabrir(item)} disabled={reabrirLancamento.isPending}>
                        <RotateCcw className="h-3 w-3" />
                        {reabrirLancamento.isPending ? "..." : "Reabrir"}
                      </Button>}
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>}
      </ModuleCard>

      <MovimentoManualFormModal open={modalManualOpen} onOpenChange={setModalManualOpen} movimentacao={movimentoEdicao} onSuccess={() => {
      queryClient.invalidateQueries({
        queryKey: ["manual_transactions"]
      });
      queryClient.invalidateQueries({
        queryKey: ["movimentos_financeiros"]
      });
      queryClient.invalidateQueries({
        queryKey: ["movimentos_manuais"]
      });
    }} />
    </div>;
}
export default function Conciliacao() {
  const [activeTab, setActiveTab] = useState("bancaria");
  return <MainLayout title="Conciliações" subtitle="Central de conciliação bancária, cartões, marketplace e ajustes manuais" actions={<div className="flex items-center gap-2">
          
          
        </div>}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="bancaria" className="gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Bancária</span>
          </TabsTrigger>
          <TabsTrigger value="cartoes" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Cartões</span>
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Marketplace</span>
          </TabsTrigger>
          <TabsTrigger value="importacoes" className="gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Importações</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">Manual</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bancaria">
          <BancariaTab />
        </TabsContent>

        <TabsContent value="cartoes">
          <CartoesTab />
        </TabsContent>

        <TabsContent value="marketplace">
          <MarketplaceTab />
        </TabsContent>

        <TabsContent value="importacoes">
          <ImportacoesTab />
        </TabsContent>

        <TabsContent value="manual">
          <ManualTab />
        </TabsContent>
      </Tabs>
    </MainLayout>;
}