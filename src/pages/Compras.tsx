import { useState, useMemo } from "react";
import { Plus, Search, FileText, Package, BarChart3, CheckCircle2, Upload, ChevronRight, ShoppingCart, Truck, Clock, XCircle, LayoutList } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RegistrarRecebimentoModal } from "@/components/purchases/RegistrarRecebimentoModal";
import { ImportarNFeXMLModal } from "@/components/purchases/ImportarNFeXMLModal";
import { CompraManualFormModal } from "@/components/purchases/CompraManualFormModal";
import { CompraItensGrid } from "@/components/purchases/CompraItensGrid";
import { useToast } from "@/hooks/use-toast";
import { useCompras, Compra, StatusCompra } from "@/hooks/useCompras";
import { useEmpresas } from "@/hooks/useEmpresas";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COMPRA: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: Clock },
  pago: { label: "Pago", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: CheckCircle2 },
  em_transito: { label: "Em Trânsito", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Truck },
  parcial: { label: "Parcial", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Package },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
};

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (date: string) => {
  try {
    return format(new Date(date), 'dd/MM/yyyy');
  } catch {
    return date;
  }
};

const STATUS_TABS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: "todos", label: "Todas", icon: LayoutList },
  { key: "rascunho", label: "Rascunho", icon: Clock },
  { key: "pago", label: "Pago", icon: ShoppingCart },
  { key: "em_transito", label: "Em Trânsito", icon: Truck },
  { key: "parcial", label: "Parcial", icon: Package },
  { key: "concluido", label: "Concluído", icon: CheckCircle2 },
  { key: "cancelado", label: "Cancelado", icon: XCircle },
];

// Hierarquia de status para impedir retrocesso
const STATUS_ORDEM: Record<string, number> = {
  rascunho: 1,
  pago: 2,
  em_transito: 3,
  parcial: 4,
  concluido: 5,
  cancelado: 99, // Pode ser selecionado a qualquer momento
};

export default function Compras() {
  const { toast } = useToast();
  const { empresas = [] } = useEmpresas();
  const [empresaFilter, setEmpresaFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [expandedCompra, setExpandedCompra] = useState<string | null>(null);
  
  const { compras = [], isLoading, refetch, atualizarStatus, resumo } = useCompras({
    empresaId: empresaFilter !== "todos" ? empresaFilter : undefined,
  });

  const [searchTerm, setSearchTerm] = useState("");

  const [recebimentoModalOpen, setRecebimentoModalOpen] = useState(false);
  const [recebimentoPurchase, setRecebimentoPurchase] = useState<Compra | null>(null);
  const [importXMLModalOpen, setImportXMLModalOpen] = useState(false);
  const [compraManualModalOpen, setCompraManualModalOpen] = useState(false);

  const existingKeys = useMemo(() => {
    return compras.filter(c => c.chave_acesso).map(c => c.chave_acesso!);
  }, [compras]);

  const filteredPurchases = useMemo(() => {
    return compras.filter((p) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!p.fornecedor_nome.toLowerCase().includes(term) && !p.numero_nf?.includes(searchTerm)) {
          return false;
        }
      }
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      return true;
    });
  }, [compras, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const totalCompras = compras.length;
    const valorTotal = compras.reduce((sum, c) => sum + c.valor_total, 0);
    const comprasConcluidas = compras.filter(c => c.status === 'concluido').length;
    const itensNaoMapeados = compras.reduce((sum, c) => {
      return sum + (c.itens?.filter(i => !i.mapeado).length || 0);
    }, 0);
    return { totalCompras, valorTotal, comprasConcluidas, itensNaoMapeados };
  }, [compras]);

  const handleOpenRecebimento = (purchase: Compra) => {
    setRecebimentoPurchase(purchase);
    setRecebimentoModalOpen(true);
  };

  const handleStatusChange = async (compraId: string, novoStatus: string, statusAtual: string) => {
    // Parcial e Concluído só podem ser alterados automaticamente pelo sistema
    if (novoStatus === 'parcial' || novoStatus === 'concluido') {
      toast({ title: "Ação não permitida", description: "Status Parcial e Concluído são definidos automaticamente após recebimento.", variant: "destructive" });
      return;
    }
    
    // Impedir retrocesso de status (exceto cancelamento)
    if (novoStatus !== 'cancelado' && STATUS_ORDEM[novoStatus] < STATUS_ORDEM[statusAtual]) {
      toast({ title: "Ação não permitida", description: "Não é possível retroceder o status.", variant: "destructive" });
      return;
    }
    
    try {
      await atualizarStatus.mutateAsync({ id: compraId, status: novoStatus as StatusCompra });
      toast({ title: "Status atualizado", description: `Compra alterada para ${STATUS_COMPRA[novoStatus]?.label}` });
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível atualizar o status", variant: "destructive" });
    }
  };

  const handleRecebimentoSuccess = () => {
    refetch();
    toast({ title: "Recebimento registrado", description: "Estoque atualizado com sucesso!" });
  };

  const getStatusCount = (status: string) => {
    if (status === "todos") return compras.length;
    return compras.filter(c => c.status === status).length;
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Módulo de Compras</h1>
              <p className="text-muted-foreground">Gerencie compras, recebimentos e integração com NFs</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setImportXMLModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar NF-e XML
              </Button>
              <Button variant="outline" onClick={() => setCompraManualModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Compra Manual
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{summary.totalCompras}</div>
                <div className="text-sm text-muted-foreground">Total de Compras</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{formatCurrency(summary.valorTotal)}</div>
                <div className="text-sm text-muted-foreground">Valor Total</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{summary.comprasConcluidas}</div>
                <div className="text-sm text-muted-foreground">Concluídas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-500">{summary.itensNaoMapeados}</div>
                <div className="text-sm text-muted-foreground">Itens Não Mapeados</div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4">
              <div className="flex gap-6">
                {/* Sidebar de Status */}
                <div className="w-56 shrink-0 space-y-1">
                  {STATUS_TABS.map((tab) => {
                    const IconComponent = tab.icon;
                    const isActive = statusFilter === tab.key;
                    const count = getStatusCount(tab.key);
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left",
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          <span className="text-sm font-medium">{tab.label}</span>
                        </div>
                        <Badge 
                          variant={isActive ? "secondary" : "outline"} 
                          className={cn("min-w-[28px] justify-center", isActive && "bg-primary-foreground/20 text-primary-foreground")}
                        >
                          {count}
                        </Badge>
                      </button>
                    );
                  })}
                </div>

                {/* Conteúdo Principal */}
                <Card className="flex-1">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar por fornecedor ou NF..." 
                          value={searchTerm} 
                          onChange={(e) => setSearchTerm(e.target.value)} 
                          className="pl-9" 
                        />
                      </div>
                      <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todas as empresas</SelectItem>
                          {empresas.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nome_fantasia || e.razao_social}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Carregando compras...</div>
                    ) : filteredPurchases.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma compra encontrada. As compras serão criadas automaticamente ao importar NF-e.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredPurchases.map((purchase) => {
                          const unmapped = purchase.itens?.filter((i) => !i.mapeado).length || 0;
                          const statusInfo = STATUS_COMPRA[purchase.status] || STATUS_COMPRA.rascunho;
                          const podeReceber = purchase.status !== 'concluido' && purchase.status !== 'cancelado';
                          const isExpanded = expandedCompra === purchase.id;
                          
                          return (
                            <Collapsible 
                              key={purchase.id} 
                              open={isExpanded}
                              onOpenChange={(open) => setExpandedCompra(open ? purchase.id : null)}
                            >
                              <div className="border rounded-lg">
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                      <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                                      <div>
                                        <div className="font-medium">{purchase.fornecedor_nome}</div>
                                        <div className="text-sm text-muted-foreground flex gap-3">
                                          <span>{formatDate(purchase.data_pedido)}</span>
                                          {purchase.numero_nf && <span className="font-mono">NF: {purchase.numero_nf}</span>}
                                          <span>{purchase.itens?.length || 0} itens</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      {unmapped > 0 && (
                                        <Badge variant="outline" className="bg-warning/10 text-warning">
                                          {unmapped} s/ vínculo
                                        </Badge>
                                      )}
                                      <div className="text-right">
                                        <div className="font-bold">{formatCurrency(purchase.valor_total)}</div>
                                      </div>
                                      <Select 
                                        value={purchase.status} 
                                        onValueChange={(value) => handleStatusChange(purchase.id, value, purchase.status)}
                                      >
                                        <SelectTrigger className="w-36 h-8" onClick={(e) => e.stopPropagation()}>
                                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="rascunho">Rascunho</SelectItem>
                                          <SelectItem value="pago">Pago</SelectItem>
                                          <SelectItem value="em_transito">Em Trânsito</SelectItem>
                                          <SelectItem value="cancelado">Cancelado</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {podeReceber && (
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={(e) => { e.stopPropagation(); handleOpenRecebimento(purchase); }} 
                                        >
                                          <Package className="h-4 w-4 mr-2" />
                                          Receber
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="border-t p-4 bg-muted/30">
                                    <CompraItensGrid itens={purchase.itens || []} />
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
          </div>
        </div>
      </main>

      <RegistrarRecebimentoModal
        open={recebimentoModalOpen}
        onOpenChange={setRecebimentoModalOpen}
        compra={recebimentoPurchase}
        onSuccess={handleRecebimentoSuccess}
      />

      <ImportarNFeXMLModal
        open={importXMLModalOpen}
        onOpenChange={setImportXMLModalOpen}
        onImportSuccess={() => refetch()}
        existingKeys={existingKeys}
      />

      <CompraManualFormModal
        open={compraManualModalOpen}
        onOpenChange={setCompraManualModalOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}