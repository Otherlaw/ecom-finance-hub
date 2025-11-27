import { useState, useMemo } from "react";
import { Plus, Search, FileText, Package, Eye, Link2, Upload, BarChart3 } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseFormModal } from "@/components/purchases/PurchaseFormModal";
import { NFProductMappingModal } from "@/components/purchases/NFProductMappingModal";
import { ABCCurveAnalysis } from "@/components/purchases/ABCCurveAnalysis";
import { useToast } from "@/hooks/use-toast";
import { Purchase, mockPurchases, EMPRESAS, STATUS_COMPRA, formatCurrency, formatDate, calculatePurchaseSummary } from "@/lib/purchases-data";
import { mockProducts, mockSalesHistory, mockPurchaseHistory as productPurchaseHistory } from "@/lib/products-data";

export default function Compras() {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>(mockPurchases);
  const [searchTerm, setSearchTerm] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [mappingPurchase, setMappingPurchase] = useState<Purchase | null>(null);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (searchTerm && !p.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) && !p.numeroNF?.includes(searchTerm)) return false;
      if (empresaFilter !== "todos" && p.empresa !== empresaFilter) return false;
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      return true;
    });
  }, [purchases, searchTerm, empresaFilter, statusFilter]);

  const summary = useMemo(() => calculatePurchaseSummary(purchases), [purchases]);

  const handleSavePurchase = (purchase: Purchase) => {
    setPurchases((prev) => {
      const index = prev.findIndex((p) => p.id === purchase.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = purchase;
        return updated;
      }
      return [...prev, purchase];
    });
  };

  const handleOpenMapping = (purchase: Purchase) => {
    setMappingPurchase(purchase);
    setMappingModalOpen(true);
  };

  const handleCreateProductFromItem = () => {
    toast({ title: "Criar Produto", description: "Abra o módulo de Produtos para criar um novo item." });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Módulo de Compras</h1>
              <p className="text-muted-foreground">Gerencie compras e integração com NFs</p>
            </div>
            <Button onClick={() => { setEditingPurchase(null); setFormModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Compra Manual
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.totalCompras}</div><div className="text-sm text-muted-foreground">Total de Compras</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{formatCurrency(summary.valorTotal)}</div><div className="text-sm text-muted-foreground">Valor Total</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-success">{summary.comprasConfirmadas}</div><div className="text-sm text-muted-foreground">Confirmadas</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-warning">{summary.itensNaoMapeados}</div><div className="text-sm text-muted-foreground">Itens Não Mapeados</div></CardContent></Card>
          </div>

          <Tabs defaultValue="compras">
            <TabsList>
              <TabsTrigger value="compras"><FileText className="h-4 w-4 mr-2" />Compras</TabsTrigger>
              <TabsTrigger value="curva-abc"><BarChart3 className="h-4 w-4 mr-2" />Curva ABC</TabsTrigger>
            </TabsList>

            <TabsContent value="compras" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar por fornecedor ou NF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                    </div>
                    <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Empresa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas</SelectItem>
                        {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="em_aberto">Em Aberto</SelectItem>
                        <SelectItem value="confirmada">Confirmada</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>NF</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="text-center">Itens</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchases.map((purchase) => {
                        const unmapped = purchase.itens.filter((i) => !i.mapeado).length;
                        return (
                          <TableRow key={purchase.id}>
                            <TableCell>{formatDate(purchase.dataCompra)}</TableCell>
                            <TableCell className="font-mono">{purchase.numeroNF || "-"}</TableCell>
                            <TableCell className="max-w-48 truncate">{purchase.fornecedor}</TableCell>
                            <TableCell><Badge variant="outline">{purchase.empresa}</Badge></TableCell>
                            <TableCell className="text-center">
                              {purchase.itens.length}
                              {unmapped > 0 && <Badge variant="outline" className="ml-2 bg-warning/10 text-warning">{unmapped} s/ vínculo</Badge>}
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(purchase.valorTotal)}</TableCell>
                            <TableCell><Badge className={STATUS_COMPRA[purchase.status].color}>{STATUS_COMPRA[purchase.status].label}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenMapping(purchase)} title="Mapear produtos"><Link2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="curva-abc" className="mt-4">
              <ABCCurveAnalysis products={mockProducts} salesHistory={mockSalesHistory} purchaseHistory={productPurchaseHistory} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <PurchaseFormModal open={formModalOpen} onOpenChange={setFormModalOpen} purchase={editingPurchase} products={mockProducts} onSave={handleSavePurchase} />
      <NFProductMappingModal open={mappingModalOpen} onOpenChange={setMappingModalOpen} purchase={mappingPurchase} products={mockProducts} onSave={handleSavePurchase} onCreateProduct={handleCreateProductFromItem} />
    </div>
  );
}
