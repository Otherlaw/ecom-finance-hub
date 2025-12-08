import { useState, useMemo } from "react";
import { Plus, Search, FileText, Package, BarChart3, CheckCircle2, Upload } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RegistrarRecebimentoModal } from "@/components/purchases/RegistrarRecebimentoModal";
import { ImportarNFeXMLModal } from "@/components/purchases/ImportarNFeXMLModal";
import { CompraManualFormModal } from "@/components/purchases/CompraManualFormModal";
import { useToast } from "@/hooks/use-toast";
import { useCompras, Compra } from "@/hooks/useCompras";
import { useEmpresas } from "@/hooks/useEmpresas";
import { format } from "date-fns";

const STATUS_COMPRA: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
  confirmada: { label: "Confirmada", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  em_transito: { label: "Em Trânsito", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  parcial: { label: "Parcial", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
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

export default function Compras() {
  const { toast } = useToast();
  const { empresas = [] } = useEmpresas();
  const [empresaFilter, setEmpresaFilter] = useState<string>("todos");
  
  const { compras = [], isLoading, refetch, atualizarStatus } = useCompras({
    empresaId: empresaFilter !== "todos" ? empresaFilter : undefined,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

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

  const handleStatusChange = async (compraId: string, novoStatus: string) => {
    try {
      await atualizarStatus.mutateAsync({ id: compraId, status: novoStatus as any });
      toast({ title: "Status atualizado", description: `Compra alterada para ${STATUS_COMPRA[novoStatus]?.label}` });
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível atualizar o status", variant: "destructive" });
    }
  };

  const handleRecebimentoSuccess = () => {
    refetch();
    toast({ title: "Recebimento registrado", description: "Estoque atualizado com sucesso!" });
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
                <div className="text-2xl font-bold text-success">{summary.comprasConcluidas}</div>
                <div className="text-sm text-muted-foreground">Concluídas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-warning">{summary.itensNaoMapeados}</div>
                <div className="text-sm text-muted-foreground">Itens Não Mapeados</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="compras">
            <TabsList>
              <TabsTrigger value="compras"><FileText className="h-4 w-4 mr-2" />Compras</TabsTrigger>
              <TabsTrigger value="curva-abc" disabled><BarChart3 className="h-4 w-4 mr-2" />Curva ABC</TabsTrigger>
            </TabsList>

            <TabsContent value="compras" className="mt-4">
              <Card>
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
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="rascunho">Rascunho</SelectItem>
                        <SelectItem value="confirmada">Confirmada</SelectItem>
                        <SelectItem value="em_transito">Em Trânsito</SelectItem>
                        <SelectItem value="parcial">Parcial</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>NF</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead className="text-center">Itens</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPurchases.map((purchase) => {
                          const unmapped = purchase.itens?.filter((i) => !i.mapeado).length || 0;
                          const statusInfo = STATUS_COMPRA[purchase.status] || STATUS_COMPRA.rascunho;
                          const podeReceber = purchase.status !== 'concluido' && purchase.status !== 'cancelado';
                          
                          return (
                            <TableRow key={purchase.id}>
                              <TableCell>{formatDate(purchase.data_pedido)}</TableCell>
                              <TableCell className="font-mono">{purchase.numero_nf || "-"}</TableCell>
                              <TableCell className="max-w-48 truncate">{purchase.fornecedor_nome}</TableCell>
                              <TableCell className="text-center">
                                {purchase.itens?.length || 0}
                                {unmapped > 0 && (
                                  <Badge variant="outline" className="ml-2 bg-warning/10 text-warning">
                                    {unmapped} s/ vínculo
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(purchase.valor_total)}
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={purchase.status} 
                                  onValueChange={(value) => handleStatusChange(purchase.id, value)}
                                >
                                  <SelectTrigger className="w-32 h-8">
                                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="rascunho">Rascunho</SelectItem>
                                    <SelectItem value="confirmada">Confirmada</SelectItem>
                                    <SelectItem value="em_transito">Em Trânsito</SelectItem>
                                    <SelectItem value="parcial">Parcial</SelectItem>
                                    <SelectItem value="concluido">Concluído</SelectItem>
                                    <SelectItem value="cancelada">Cancelada</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {podeReceber && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleOpenRecebimento(purchase)} 
                                      title="Registrar recebimento"
                                    >
                                      <Package className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {purchase.status === 'concluido' && (
                                    <CheckCircle2 className="h-4 w-4 text-success ml-2" />
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="curva-abc" className="mt-4">
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Análise de Curva ABC disponível em breve
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
