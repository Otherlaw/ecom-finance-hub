import { useState, useMemo } from "react";
import { Plus, Search, Eye, Edit, Package, Trash2, Upload, Download } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { ImportProdutosModal } from "@/components/products/ImportProdutosModal";
import { ExportProdutosModal } from "@/components/products/ExportProdutosModal";
import { DeleteProdutoModal } from "@/components/products/DeleteProdutoModal";
import { useProdutos } from "@/hooks/useProdutos";
import { useEmpresas } from "@/hooks/useEmpresas";
import {
  Product,
  mockSalesHistory,
  mockPurchaseHistory,
  CATEGORIAS_PRODUTO,
  CANAIS_VENDA,
  formatCurrency,
} from "@/lib/products-data";
import type { Produto } from "@/lib/motor-custos";

export default function Produtos() {
  const { empresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const { produtos, isLoading, refetch, resumo } = useProdutos({
    empresaId: empresaId || undefined,
    status: statusFilter === "todos" ? "todos" : statusFilter as "ativo" | "inativo",
    categoria: categoryFilter !== "todos" ? categoryFilter : undefined,
    busca: searchTerm || undefined,
  });

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deletingProduto, setDeletingProduto] = useState<Produto | null>(null);

  // Converter Produto do Supabase para o formato do modal
  const convertToProduct = (p: Produto): Product => ({
    id: p.id,
    codigoInterno: p.codigo_interno,
    nome: p.nome,
    descricao: p.descricao || "",
    categoria: p.categoria || "",
    subcategoria: p.subcategoria,
    unidadeMedida: p.unidade_medida,
    ncm: p.ncm || "",
    cfopVenda: p.cfop_venda,
    cfopCompra: p.cfop_compra,
    situacaoTributaria: p.situacao_tributaria,
    fornecedorPrincipalId: p.fornecedor_principal_id,
    fornecedorPrincipalNome: p.fornecedor_principal_nome,
    custoMedio: p.custo_medio_atual,
    precoVendaSugerido: p.preco_venda_sugerido,
    canais: p.canais || [],
    status: p.status,
    observacoes: p.observacoes,
    dataCadastro: p.created_at || "",
    dataAtualizacao: p.updated_at || "",
  });

  const handleEdit = (produto: Produto) => {
    setEditingProduct(convertToProduct(produto));
    setFormModalOpen(true);
  };

  const handleView = (produto: Produto) => {
    setSelectedProduct(convertToProduct(produto));
    setDetailModalOpen(true);
  };

  const handleDelete = (produto: Produto) => {
    setDeletingProduto(produto);
    setDeleteModalOpen(true);
  };

  const handleSaveProduct = () => {
    refetch();
  };

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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setExportModalOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <Button onClick={() => { setEditingProduct(null); setFormModalOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{resumo.total}</div>
                    <div className="text-sm text-muted-foreground">Total de Produtos</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-success">{resumo.ativos}</div>
                <div className="text-sm text-muted-foreground">Produtos Ativos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{resumo.produtosComEstoque}</div>
                <div className="text-sm text-muted-foreground">Com Estoque</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{formatCurrency(resumo.valorEstoque)}</div>
                <div className="text-sm text-muted-foreground">Valor Est. em Estoque</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todas empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando produtos...</div>
              ) : produtos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum produto encontrado. Use o botão "Importar" para adicionar produtos em massa.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((produto) => (
                      <TableRow key={produto.id}>
                        <TableCell className="font-mono text-sm">{produto.codigo_interno}</TableCell>
                        <TableCell>
                          <div className="font-medium max-w-64 truncate">{produto.nome}</div>
                          {produto.canais && (produto.canais as any[]).length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {(produto.canais as any[]).slice(0, 3).map((c: any) => (
                                <Badge key={c.channel} variant="outline" className="text-xs">
                                  {CANAIS_VENDA.find((x) => x.id === c.channel)?.nome || c.channel}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{produto.categoria || "-"}</TableCell>
                        <TableCell className="font-mono">{produto.ncm || "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(produto.custo_medio_atual)}</TableCell>
                        <TableCell className="text-right">{produto.estoque_atual}</TableCell>
                        <TableCell>
                          <Badge variant={produto.status === "ativo" ? "default" : "secondary"}>
                            {produto.status === "ativo" ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleView(produto)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(produto)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(produto)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <ProductFormModal 
        open={formModalOpen} 
        onOpenChange={setFormModalOpen} 
        product={editingProduct} 
        onSave={handleSaveProduct} 
      />
      <ProductDetailModal 
        open={detailModalOpen} 
        onOpenChange={setDetailModalOpen} 
        product={selectedProduct} 
        salesHistory={mockSalesHistory} 
        purchaseHistory={mockPurchaseHistory} 
      />
      <ImportProdutosModal 
        open={importModalOpen} 
        onOpenChange={setImportModalOpen} 
        onSuccess={() => refetch()} 
      />
      <ExportProdutosModal 
        open={exportModalOpen} 
        onOpenChange={setExportModalOpen} 
      />
      <DeleteProdutoModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        produto={deletingProduto}
        onDeleted={() => refetch()}
        onInactivate={() => refetch()}
      />
    </div>
  );
}
