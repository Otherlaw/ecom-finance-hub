import { useState, useMemo } from "react";
import { Plus, Search, Eye, Edit, Package, Filter } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ProductFormModal } from "@/components/products/ProductFormModal";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";
import {
  Product,
  mockProducts,
  mockSalesHistory,
  mockPurchaseHistory,
  CATEGORIAS_PRODUTO,
  CANAIS_VENDA,
  formatCurrency,
  formatDate,
} from "@/lib/products-data";

export default function Produtos() {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [channelFilter, setChannelFilter] = useState<string>("todos");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !product.nome.toLowerCase().includes(search) &&
          !product.codigoInterno.toLowerCase().includes(search) &&
          !product.ncm.includes(search)
        ) {
          return false;
        }
      }
      if (categoryFilter !== "todos" && product.categoria !== categoryFilter) return false;
      if (statusFilter !== "todos" && product.status !== statusFilter) return false;
      if (channelFilter !== "todos" && !product.canais.some((c) => c.channel === channelFilter)) return false;
      return true;
    });
  }, [products, searchTerm, categoryFilter, statusFilter, channelFilter]);

  const handleSaveProduct = (product: Product) => {
    setProducts((prev) => {
      const index = prev.findIndex((p) => p.id === product.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = product;
        return updated;
      }
      return [...prev, product];
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormModalOpen(true);
  };

  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setDetailModalOpen(true);
  };

  const stats = useMemo(() => ({
    total: products.length,
    ativos: products.filter((p) => p.status === "ativo").length,
    valorEstoque: products.reduce((sum, p) => sum + p.custoMedio * 10, 0),
  }), [products]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cadastro de Produtos</h1>
              <p className="text-muted-foreground">Gerencie o catálogo de produtos</p>
            </div>
            <Button onClick={() => { setEditingProduct(null); setFormModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Total de Produtos</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-success">{stats.ativos}</div>
                <div className="text-sm text-muted-foreground">Produtos Ativos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{formatCurrency(stats.valorEstoque)}</div>
                <div className="text-sm text-muted-foreground">Valor Est. em Estoque</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, SKU ou NCM..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {CATEGORIAS_PRODUTO.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Canal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {CANAIS_VENDA.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead className="text-right">Custo Médio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.codigoInterno}</TableCell>
                      <TableCell>
                        <div className="font-medium max-w-64 truncate">{product.nome}</div>
                        {product.canais.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {product.canais.slice(0, 3).map((c) => (
                              <Badge key={c.channel} variant="outline" className="text-xs">{CANAIS_VENDA.find((x) => x.id === c.channel)?.nome}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{product.categoria}</TableCell>
                      <TableCell className="font-mono">{product.ncm}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.custoMedio)}</TableCell>
                      <TableCell>
                        <Badge variant={product.status === "ativo" ? "default" : "secondary"}>
                          {product.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleView(product)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}><Edit className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      <ProductFormModal open={formModalOpen} onOpenChange={setFormModalOpen} product={editingProduct} onSave={handleSaveProduct} />
      <ProductDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} product={selectedProduct} salesHistory={mockSalesHistory} purchaseHistory={mockPurchaseHistory} />
    </div>
  );
}
