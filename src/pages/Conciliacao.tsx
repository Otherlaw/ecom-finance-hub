import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/mock-data";
import {
  RefreshCw,
  Upload,
  Download,
  Check,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Search,
  Filter,
  Building,
  CreditCard,
  ShoppingBag,
  PenLine,
  Eye,
  Tag,
  RotateCcw,
  Ban,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFaturas, useTransacoes } from "@/hooks/useCartoes";
import { useBankTransactions, BankTransaction } from "@/hooks/useBankTransactions";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { CategorizacaoModal } from "@/components/conciliacao/CategorizacaoModal";
import { CategorizacaoBancariaModal } from "@/components/conciliacao/CategorizacaoBancariaModal";
import { ImportarExtratoBancarioModal } from "@/components/conciliacao/ImportarExtratoBancarioModal";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const mockMarketplace = [
  { id: 1, data: "01/11", descricao: "Repasse ML - Lote #12345", valorRepasse: 45000, valorVendas: 45000, status: "ok", canal: "Mercado Livre" },
  { id: 2, data: "05/11", descricao: "Repasse Shopee - Lote #67890", valorRepasse: 12500, valorVendas: 12800, status: "divergencia", canal: "Shopee", diferenca: 300 },
  { id: 3, data: "08/11", descricao: "Repasse TikTok - Lote #11111", valorRepasse: 8900, valorVendas: 8900, status: "ok", canal: "TikTok Shop" },
  { id: 4, data: "12/11", descricao: "Repasse Shein - Lote #22222", valorRepasse: 0, valorVendas: 5600, status: "faltando", canal: "Shein", diferenca: 5600 },
];

const mockManual = [
  { id: 1, data: "15/11", descricao: "Ajuste de Inventário", valor: -1200, tipo: "Despesa", status: "pendente", responsavel: "João Silva" },
  { id: 2, data: "18/11", descricao: "Reembolso Cliente", valor: 350, tipo: "Receita", status: "aprovado", responsavel: "Maria Santos" },
  { id: 3, data: "20/11", descricao: "Correção Lançamento Duplicado", valor: -2500, tipo: "Ajuste", status: "pendente", responsavel: "Admin" },
];

function calculateTotals(data: any[], statusField = "status") {
  return {
    registros: data.length,
    conciliados: data.filter(c => c[statusField] === "ok" || c[statusField] === "aprovado" || c[statusField] === "conciliado").length,
    divergencias: data.filter(c => c[statusField] === "divergencia").length,
    pendentes: data.filter(c => c[statusField] === "faltando" || c[statusField] === "pendente").length,
    totalDiferencas: data.reduce((acc, c) => acc + (c.diferenca || 0), 0),
  };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ok" || status === "aprovado" || status === "conciliado") {
    return (
      <Badge className="bg-success/10 text-success border-success/20">
        <Check className="h-3 w-3 mr-1" />
        {status === "aprovado" ? "Aprovado" : status === "conciliado" ? "Conciliado" : "OK"}
      </Badge>
    );
  }
  if (status === "divergencia") {
    return (
      <Badge className="bg-warning/10 text-warning border-warning/20">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Divergência
      </Badge>
    );
  }
  if (status === "faltando" || status === "pendente") {
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20">
        <X className="h-3 w-3 mr-1" />
        {status === "pendente" ? "Pendente" : "Faltando"}
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function SummaryCards({ totals }: { totals: ReturnType<typeof calculateTotals> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
          {totals.registros > 0 ? ((totals.conciliados / totals.registros) * 100).toFixed(0) : 0}%
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
        {totals.totalDiferencas > 0 && (
          <p className="text-xs text-muted-foreground">{formatCurrency(totals.totalDiferencas)}</p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ totals }: { totals: ReturnType<typeof calculateTotals> }) {
  const progress = totals.registros > 0 ? (totals.conciliados / totals.registros) * 100 : 0;
  return (
    <div className="mb-6 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Progresso da Conciliação</span>
        <span className="text-sm text-muted-foreground">
          {totals.conciliados} de {totals.registros} registros
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

function FilterBar({ showExport = true }: { showExport?: boolean }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por descrição..." className="pl-10" />
      </div>
      <Button variant="outline" className="gap-2">
        <Filter className="h-4 w-4" />
        Filtrar
      </Button>
      {showExport && (
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      )}
    </div>
  );
}

// Tab content components
function BancariaTab() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [categorizacaoModal, setCategorizacaoModal] = useState<{
    open: boolean;
    transacao: BankTransaction | null;
  }>({ open: false, transacao: null });
  
  // Filtros
  const [empresaId, setEmpresaId] = useState<string>("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  
  // Período padrão: mês atual
  const hoje = new Date();
  const periodoInicio = format(startOfMonth(hoje), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(hoje), "yyyy-MM-dd");
  
  const { empresas } = useEmpresas();
  const { transacoes, resumo, isLoading, refetch } = useBankTransactions({
    empresaId: empresaId || undefined,
    periodoInicio,
    periodoFim,
    status: statusFiltro,
  });
  
  // Filtro de busca local
  const transacoesFiltradas = transacoes.filter((t) => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      t.descricao.toLowerCase().includes(termo) ||
      t.documento?.toLowerCase().includes(termo)
    );
  });
  
  const totals = {
    registros: transacoesFiltradas.length,
    conciliados: resumo.conciliadas,
    divergencias: 0,
    pendentes: resumo.importadas + resumo.pendentes,
    totalDiferencas: 0,
  };
  
  const handleCategorizar = (transacao: BankTransaction) => {
    setCategorizacaoModal({ open: true, transacao });
  };
  
  const handleCategorizacaoSuccess = () => {
    refetch();
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  
  return (
    <div>
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
      {resumo.total > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso da Conciliação</span>
            <span className="text-sm text-muted-foreground">
              {resumo.conciliadas} de {resumo.total} registros
            </span>
          </div>
          <Progress value={(resumo.conciliadas / resumo.total) * 100} className="h-2" />
        </div>
      )}
      
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por descrição..." 
            className="pl-10" 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as empresas</SelectItem>
            {empresas?.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.nome_fantasia || emp.razao_social}
              </SelectItem>
            ))}
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
        
        <Button className="gap-2 ml-auto" onClick={() => setImportModalOpen(true)}>
          <Upload className="h-4 w-4" />
          Importar Extrato
        </Button>
      </div>
      
      <ModuleCard title="Conciliação Bancária" description="Transações importadas de extratos" icon={Building} noPadding>
        {transacoesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhuma transação bancária encontrada</p>
            <p className="text-sm mt-1">Importe um extrato bancário para iniciar a conciliação</p>
            <Button className="mt-4 gap-2" onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar Extrato
            </Button>
          </div>
        ) : (
          <Table>
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
              {transacoesFiltradas.map((t) => (
                <TableRow 
                  key={t.id} 
                  className={
                    t.status === "conciliado" ? "bg-success/5" :
                    t.status === "ignorado" ? "bg-muted/30 opacity-60" :
                    t.status === "pendente" ? "bg-warning/5" : ""
                  }
                >
                  <TableCell className="font-medium">
                    {new Date(t.data_transacao).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{t.descricao}</span>
                      {t.documento && (
                        <p className="text-xs text-muted-foreground">Doc: {t.documento}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.categoria ? (
                      <Badge variant="outline" className="bg-success/5 border-success/30 text-success">
                        {t.categoria.nome}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Não categorizado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.centro_custo ? (
                      <Badge variant="secondary">{t.centro_custo.nome}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={t.tipo_lancamento === "credito" ? "default" : "destructive"}>
                      {t.tipo_lancamento === "credito" ? "Crédito" : "Débito"}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${
                    t.tipo_lancamento === "credito" ? "text-success" : "text-destructive"
                  }`}>
                    {t.tipo_lancamento === "credito" ? "+" : "-"}{formatCurrency(t.valor)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="gap-1"
                      onClick={() => handleCategorizar(t)}
                    >
                      {t.status === "conciliado" ? (
                        <>
                          <Eye className="h-3 w-3" />
                          Ver
                        </>
                      ) : t.status === "ignorado" ? (
                        <>
                          <RotateCcw className="h-3 w-3" />
                          Reabrir
                        </>
                      ) : (
                        <>
                          <Tag className="h-3 w-3" />
                          Categorizar
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ModuleCard>
      
      {/* Modal de Importação */}
      <ImportarExtratoBancarioModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={handleCategorizacaoSuccess}
      />
      
      {/* Modal de Categorização */}
      <CategorizacaoBancariaModal
        open={categorizacaoModal.open}
        onOpenChange={(open) => setCategorizacaoModal({ ...categorizacaoModal, open })}
        transacao={categorizacaoModal.transacao}
        onSuccess={handleCategorizacaoSuccess}
      />
    </div>
  );
}

function CartoesTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { transacoes, isLoading: loadingTransacoes, refetch } = useTransacoes();
  const { faturas, isLoading: loadingFaturas } = useFaturas();
  
  // Estado do modal de categorização
  const [categorizacaoModal, setCategorizacaoModal] = useState<{
    open: boolean;
    transacao: any | null;
  }>({ open: false, transacao: null });

  // Transform real data for conciliation view
  const conciliacaoData = (transacoes || []).map((t: any) => {
    const valorCategorizado = t.categoria_id ? t.valor : 0;
    const diferenca = t.categoria_id ? 0 : t.valor;
    let status = "pendente";
    if (t.status === "conciliado") status = "conciliado";
    else if (t.status === "aprovado") status = "ok";
    else if (t.categoria_id && t.centro_custo_id) status = "ok";
    else if (t.categoria_id || t.centro_custo_id) status = "divergencia";
    
    return {
      id: t.id,
      data: new Date(t.data_transacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
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
      faturaId: t.invoice_id,
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
        centro_custo_id: item.centro_custo_id,
      },
    });
  };
  
  const handleCategorizacaoSuccess = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["dre-transacoes"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
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
        <Button variant="outline" className="gap-2" onClick={() => navigate("/cartao-credito")}>
          <Eye className="h-4 w-4" />
          Ver Módulo Completo
        </Button>
      </div>
      
      <ModuleCard title="Conciliação de Cartões" description="Transações vs Categorizadas" icon={CreditCard} noPadding>
        {conciliacaoData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhuma transação encontrada</p>
            <p className="text-sm mt-1">Importe faturas de cartão para iniciar a conciliação</p>
            <Button className="mt-4" onClick={() => navigate("/cartao-credito")}>
              Ir para Cartões de Crédito
            </Button>
          </div>
        ) : (
          <Table>
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
              {conciliacaoData.slice(0, 20).map((item: any) => (
                <TableRow key={item.id} className={item.status !== "ok" && item.status !== "conciliado" ? "bg-warning/5" : ""}>
                  <TableCell className="font-medium">{item.data}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{item.descricao}</span>
                      {item.estabelecimento && (
                        <p className="text-xs text-muted-foreground">{item.estabelecimento}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.categoria ? (
                      <Badge variant="outline" className="bg-success/5 border-success/30 text-success">
                        {item.categoria}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Não categorizado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.centroCusto ? (
                      <Badge variant="secondary">{item.centroCusto}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.valorFatura)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="gap-1"
                      onClick={() => handleCategorizar(item)}
                    >
                      <Tag className="h-3 w-3" />
                      {item.status === "ok" || item.status === "conciliado" ? "Editar" : "Categorizar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        
        {conciliacaoData.length > 20 && (
          <div className="p-4 border-t border-border text-center">
            <Button variant="link" onClick={() => navigate("/cartao-credito")}>
              Ver todas as {conciliacaoData.length} transações
            </Button>
          </div>
        )}
      </ModuleCard>
      
      {/* Modal de Categorização */}
      <CategorizacaoModal
        open={categorizacaoModal.open}
        onOpenChange={(open) => setCategorizacaoModal({ ...categorizacaoModal, open })}
        transacao={categorizacaoModal.transacao}
        tipo="cartao"
        onSuccess={handleCategorizacaoSuccess}
      />
    </div>
  );
}

function MarketplaceTab() {
  const totals = calculateTotals(mockMarketplace);
  
  return (
    <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      <FilterBar />
      
      <ModuleCard title="Conciliação de Marketplace" description="Repasses vs Vendas" icon={ShoppingBag} noPadding>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="w-[80px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Repasse</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockMarketplace.map((item) => (
              <TableRow key={item.id} className={item.status !== "ok" ? "bg-warning/5" : ""}>
                <TableCell className="font-medium">{item.data}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    item.canal === "Mercado Livre" ? "border-yellow-500 text-yellow-600" :
                    item.canal === "Shopee" ? "border-orange-500 text-orange-600" :
                    item.canal === "TikTok Shop" ? "border-pink-500 text-pink-600" :
                    "border-purple-500 text-purple-600"
                  }>
                    {item.canal}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {item.valorRepasse > 0 ? formatCurrency(item.valorRepasse) : "-"}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(item.valorVendas)}</TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  {item.diferenca ? formatCurrency(item.diferenca) : "-"}
                </TableCell>
                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-center">
                  {item.status !== "ok" && <Button variant="ghost" size="sm">Resolver</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>
    </div>
  );
}

function ManualTab() {
  const totals = calculateTotals(mockManual);
  
  return (
    <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição..." className="pl-10" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
        <Button className="gap-2">
          <PenLine className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>
      
      <ModuleCard title="Lançamentos Manuais" description="Ajustes e correções manuais" icon={PenLine} noPadding>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="w-[80px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockManual.map((item) => (
              <TableRow key={item.id} className={item.status === "pendente" ? "bg-warning/5" : ""}>
                <TableCell className="font-medium">{item.data}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    item.tipo === "Receita" ? "border-success text-success" :
                    item.tipo === "Despesa" ? "border-destructive text-destructive" :
                    ""
                  }>
                    {item.tipo}
                  </Badge>
                </TableCell>
                <TableCell>{item.responsavel}</TableCell>
                <TableCell className={`text-right font-medium ${item.valor < 0 ? "text-destructive" : "text-success"}`}>
                  {formatCurrency(item.valor)}
                </TableCell>
                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-center">
                  {item.status === "pendente" && (
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="sm" className="text-success">Aprovar</Button>
                      <Button variant="ghost" size="sm" className="text-destructive">Rejeitar</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>
    </div>
  );
}

export default function Conciliacao() {
  const [activeTab, setActiveTab] = useState("bancaria");

  return (
    <MainLayout
      title="Conciliações"
      subtitle="Central de conciliação bancária, cartões, marketplace e ajustes manuais"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reconciliar Tudo
          </Button>
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
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

        <TabsContent value="manual">
          <ManualTab />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
