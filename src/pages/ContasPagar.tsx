import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContaPagarFormModal } from "@/components/contas-pagar/ContaPagarFormModal";
import { PagamentoModal } from "@/components/contas-pagar/PagamentoModal";
import { ContaPagarDetailModal } from "@/components/contas-pagar/ContaPagarDetailModal";
import { ImportContasPagarModal } from "@/components/contas-pagar/ImportContasPagarModal";
import {
  ContaPagar,
  ContaPagarFormData,
  Pagamento,
  StatusContaPagar,
  STATUS_CONTA_PAGAR,
  TIPO_LANCAMENTO,
  FORMA_PAGAMENTO,
  mockContasPagar,
  mockEmpresas,
  mockCategorias,
  mockCentrosCusto,
  calculateSummary,
  formatCurrency,
  formatDate,
  isOverdue,
  getDaysUntilDue,
} from "@/lib/contas-pagar-data";
import { REGIME_TRIBUTARIO_CONFIG } from "@/lib/empresas-data";
import {
  DollarSign,
  Plus,
  Download,
  Upload,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  User,
  FileText,
  Eye,
  CreditCard,
  TrendingDown,
  Wallet,
  MoreHorizontal,
  Paperclip,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ContasPagar() {
  const [contas, setContas] = useState<ContaPagar[]>(mockContasPagar);
  const [selectedContas, setSelectedContas] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [filterVencimento, setFilterVencimento] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("todas");

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<ContaPagar | null>(null);

  // Update status for overdue accounts
  const updatedContas = useMemo(() => {
    return contas.map(conta => {
      if (conta.status === 'em_aberto' && isOverdue(conta.dataVencimento, conta.status)) {
        return { ...conta, status: 'vencido' as StatusContaPagar };
      }
      return conta;
    });
  }, [contas]);

  // Filter contas
  const filteredContas = useMemo(() => {
    return updatedContas.filter(conta => {
      // Search
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          conta.descricao.toLowerCase().includes(search) ||
          conta.fornecedorNome.toLowerCase().includes(search) ||
          conta.documento?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Empresa filter
      if (filterEmpresa !== "all" && conta.empresaId !== filterEmpresa) return false;

      // Status filter
      if (filterStatus !== "all" && conta.status !== filterStatus) return false;

      // Categoria filter
      if (filterCategoria !== "all" && conta.categoriaId !== filterCategoria) return false;

      // Vencimento filter
      const days = getDaysUntilDue(conta.dataVencimento);
      if (filterVencimento === "hoje" && days !== 0) return false;
      if (filterVencimento === "semana" && (days < 0 || days > 7)) return false;
      if (filterVencimento === "mes" && (days < 0 || days > 30)) return false;
      if (filterVencimento === "vencido" && days >= 0) return false;

      // Tab filter
      if (activeTab === "abertas" && conta.status !== 'em_aberto' && conta.status !== 'parcialmente_pago') return false;
      if (activeTab === "vencidas" && conta.status !== 'vencido') return false;
      if (activeTab === "pagas" && conta.status !== 'pago') return false;

      return true;
    });
  }, [updatedContas, searchTerm, filterEmpresa, filterStatus, filterCategoria, filterVencimento, activeTab]);

  // Summary
  const summary = useMemo(() => calculateSummary(updatedContas), [updatedContas]);

  // Handlers
  const handleCreateConta = (data: ContaPagarFormData) => {
    const newConta: ContaPagar = {
      ...data,
      id: `cp-${Date.now()}`,
      valorPago: 0,
      valorEmAberto: data.valorOriginal,
      status: 'em_aberto',
      conciliado: false,
      pagamentos: [],
      dataCadastro: new Date().toISOString().split('T')[0],
      dataAtualizacao: new Date().toISOString().split('T')[0],
    };
    setContas(prev => [...prev, newConta]);
  };

  const handlePagamento = (contaId: string, pagamento: Omit<Pagamento, "id" | "contaPagarId" | "dataCadastro">) => {
    setContas(prev => prev.map(conta => {
      if (conta.id !== contaId) return conta;

      const newPagamento: Pagamento = {
        ...pagamento,
        id: `pag-${Date.now()}`,
        contaPagarId: contaId,
        dataCadastro: new Date().toISOString().split('T')[0],
      };

      const newValorPago = conta.valorPago + pagamento.valorPago;
      const newValorEmAberto = conta.valorOriginal - newValorPago;
      const newStatus: StatusContaPagar = 
        newValorEmAberto <= 0 ? 'pago' : 
        newValorPago > 0 ? 'parcialmente_pago' : 
        conta.status;

      return {
        ...conta,
        valorPago: newValorPago,
        valorEmAberto: Math.max(0, newValorEmAberto),
        status: newStatus,
        pagamentos: [...conta.pagamentos, newPagamento],
        dataAtualizacao: new Date().toISOString().split('T')[0],
      };
    }));
  };

  const handleImport = (contasToImport: ContaPagarFormData[]) => {
    const newContas = contasToImport.map((data, index) => ({
      ...data,
      id: `cp-import-${Date.now()}-${index}`,
      valorPago: 0,
      valorEmAberto: data.valorOriginal,
      status: 'em_aberto' as StatusContaPagar,
      conciliado: false,
      pagamentos: [],
      dataCadastro: new Date().toISOString().split('T')[0],
      dataAtualizacao: new Date().toISOString().split('T')[0],
    }));
    setContas(prev => [...prev, ...newContas]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContas(filteredContas.map(c => c.id));
    } else {
      setSelectedContas([]);
    }
  };

  const handleSelectConta = (contaId: string, checked: boolean) => {
    if (checked) {
      setSelectedContas(prev => [...prev, contaId]);
    } else {
      setSelectedContas(prev => prev.filter(id => id !== contaId));
    }
  };

  const handleViewDetail = (conta: ContaPagar) => {
    setSelectedConta(conta);
    setDetailModalOpen(true);
  };

  const handleOpenPagamento = (conta: ContaPagar) => {
    setSelectedConta(conta);
    setPagamentoModalOpen(true);
  };

  const handleExport = () => {
    const csvContent = [
      ["Empresa", "Fornecedor", "Descrição", "Documento", "Vencimento", "Valor Original", "Valor Pago", "Em Aberto", "Status", "Categoria"].join(","),
      ...filteredContas.map(conta => {
        const empresa = mockEmpresas.find(e => e.id === conta.empresaId);
        const categoria = mockCategorias.find(c => c.id === conta.categoriaId);
        return [
          empresa?.nome || "",
          conta.fornecedorNome,
          `"${conta.descricao}"`,
          conta.documento || "",
          conta.dataVencimento,
          conta.valorOriginal,
          conta.valorPago,
          conta.valorEmAberto,
          STATUS_CONTA_PAGAR[conta.status].label,
          categoria?.nome || "",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contas_pagar_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <MainLayout
      title="Contas a Pagar"
      subtitle="Gestão de despesas e pagamentos"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => setFormModalOpen(true)} className="bg-destructive hover:bg-destructive/90">
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <KPICard
          title="Total em Aberto"
          value={formatCurrency(summary.totalGeral)}
          icon={Wallet}
          iconColor="text-blue-500"
        />
        <KPICard
          title="Vencido"
          value={formatCurrency(summary.totalVencido)}
          changeLabel={`${summary.quantidadeVencido} título(s)`}
          icon={AlertTriangle}
          iconColor="text-destructive"
          trend="down"
        />
        <KPICard
          title="Vence Hoje"
          value={formatCurrency(summary.venceHoje)}
          icon={Clock}
          iconColor="text-amber-500"
        />
        <KPICard
          title="Vence na Semana"
          value={formatCurrency(summary.venceSemana)}
          icon={Calendar}
          iconColor="text-orange-500"
        />
        <KPICard
          title="Pago no Período"
          value={formatCurrency(summary.totalPago)}
          changeLabel={`${summary.quantidadePago} título(s)`}
          icon={CheckCircle2}
          iconColor="text-success"
          trend="up"
        />
      </div>

      {/* Filters */}
      <ModuleCard
        title="Contas a Pagar"
        description="Lista de títulos e pagamentos"
        icon={DollarSign}
        noPadding
      >
        <div className="p-4 border-b">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="abertas">
                Em Aberto
                <Badge variant="secondary" className="ml-2">
                  {updatedContas.filter(c => c.status === 'em_aberto' || c.status === 'parcialmente_pago').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="vencidas">
                Vencidas
                <Badge variant="destructive" className="ml-2">
                  {updatedContas.filter(c => c.status === 'vencido').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pagas">Pagas</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Empresas</SelectItem>
                {mockEmpresas.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {mockCategorias.filter(c => c.tipo === 'despesa').map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterVencimento} onValueChange={setFilterVencimento}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="hoje">Vence Hoje</SelectItem>
                <SelectItem value="semana">Próximos 7 dias</SelectItem>
                <SelectItem value="mes">Próximos 30 dias</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedContas.length === filteredContas.length && filteredContas.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Em Aberto</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhuma conta encontrada com os filtros aplicados
                </TableCell>
              </TableRow>
            ) : (
              filteredContas.map((conta) => {
                const empresa = mockEmpresas.find(e => e.id === conta.empresaId);
                const statusConfig = STATUS_CONTA_PAGAR[conta.status];
                const tipoConfig = TIPO_LANCAMENTO[conta.tipoLancamento];
                const days = getDaysUntilDue(conta.dataVencimento);

                return (
                  <TableRow 
                    key={conta.id}
                    className={conta.status === 'vencido' ? "bg-destructive/5" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedContas.includes(conta.id)}
                        onCheckedChange={(checked) => handleSelectConta(conta.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{empresa?.nome}</span>
                        {empresa && (
                          <span className={`text-[10px] px-1 py-0.5 rounded ${REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].bgColor}`}>
                            {REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].shortLabel}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{conta.fornecedorNome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[250px]">
                        <p className="truncate font-medium">{conta.descricao}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{tipoConfig.icon}</span>
                          {conta.documento && (
                            <>
                              <FileText className="h-3 w-3" />
                              <span>{conta.documento}</span>
                            </>
                          )}
                          {conta.anexos && conta.anexos.length > 0 && (
                            <Paperclip className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={days < 0 ? "text-destructive font-medium" : ""}>
                          {formatDate(conta.dataVencimento)}
                        </span>
                        {days === 0 && conta.status !== 'pago' && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 text-[10px]">
                            Hoje
                          </Badge>
                        )}
                        {days < 0 && conta.status !== 'pago' && (
                          <Badge variant="destructive" className="text-[10px]">
                            {Math.abs(days)}d
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(conta.valorOriginal)}
                      {conta.numeroParcelas && conta.numeroParcelas > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {conta.parcelaAtual}/{conta.numeroParcelas}x
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={conta.valorEmAberto > 0 ? "text-destructive font-medium" : "text-success"}>
                        {formatCurrency(conta.valorEmAberto)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border`}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetail(conta)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {(conta.status === 'em_aberto' || conta.status === 'vencido' || conta.status === 'parcialmente_pago') && (
                            <DropdownMenuItem onClick={() => handleOpenPagamento(conta)}>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Registrar Pagamento
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <FileText className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredContas.length} título(s) encontrado(s)
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm">
              Total em Aberto: <strong className="text-destructive">{formatCurrency(filteredContas.reduce((sum, c) => sum + c.valorEmAberto, 0))}</strong>
            </span>
          </div>
        </div>
      </ModuleCard>

      {/* Modals */}
      <ContaPagarFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        onSubmit={handleCreateConta}
      />

      <PagamentoModal
        open={pagamentoModalOpen}
        onOpenChange={setPagamentoModalOpen}
        conta={selectedConta}
        onSubmit={handlePagamento}
      />

      <ContaPagarDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        conta={selectedConta}
        onPagar={handleOpenPagamento}
      />

      <ImportContasPagarModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImport}
      />
    </MainLayout>
  );
}
