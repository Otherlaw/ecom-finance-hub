import { useState, useMemo } from "react";
import { Plus, Search, Eye, Edit, Package, Upload, Download, Trash2 } from "lucide-react";
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
import { ImportarProdutosModal } from "@/components/products/ImportarProdutosModal";
import { ExportarProdutosModal } from "@/components/products/ExportarProdutosModal";
import { ExcluirProdutoModal } from "@/components/products/ExcluirProdutoModal";
import { ProdutoImportJobsPanel } from "@/components/products/ProdutoImportJobsPanel";
import { useProdutos, Produto, ProdutoInsert, ProdutoUpdate } from "@/hooks/useProdutos";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIAS_PRODUTO, formatCurrency } from "@/lib/products-data";

export default function Produtos() {
  const { empresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");

  const empresaSelecionada = empresaId || empresas?.[0]?.id || "";

  const { produtos, isLoading, resumo, criarProduto, atualizarProduto, refetch } = useProdutos({
    empresaId: empresaSelecionada,
    status: statusFilter === "todos" ? undefined : statusFilter as "ativo" | "inativo",
    categoria: categoryFilter === "todos" ? undefined : categoryFilter,
    busca: searchTerm || undefined,
  });

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [productToDelete, setProductToDelete] = useState<Produto | null>(null);

  const filteredProducts = useMemo(() => {
    if (tipoFilter === "todos") return produtos;
    return produtos.filter((p) => p.tipo === tipoFilter);
  }, [produtos, tipoFilter]);

  const handleSaveProduct = async (productData: any) => {
    if (!empresaSelecionada) return;

    if (editingProduct) {
      const updateData: ProdutoUpdate = {
        id: editingProduct.id,
        sku: productData.codigoInterno,
        nome: productData.nome,
        descricao: productData.descricao,
        categoria: productData.categoria,
        subcategoria: productData.subcategoria,
        unidade_medida: productData.unidadeMedida,
        ncm: productData.ncm,
        cfop_venda: productData.cfopVenda,
        cfop_compra: productData.cfopCompra,
        fornecedor_nome: productData.fornecedorPrincipalNome,
        custo_medio: productData.custoMedio,
        preco_venda: productData.precoVendaSugerido,
        status: productData.status,
      };
      await atualizarProduto.mutateAsync(updateData);
    } else {
      const insertData: ProdutoInsert = {
        empresa_id: empresaSelecionada,
        sku: productData.codigoInterno,
        nome: productData.nome,
        descricao: productData.descricao,
        categoria: productData.categoria,
        subcategoria: productData.subcategoria,
        unidade_medida: productData.unidadeMedida,
        ncm: productData.ncm,
        cfop_venda: productData.cfopVenda,
        cfop_compra: productData.cfopCompra,
        fornecedor_nome: productData.fornecedorPrincipalNome,
        custo_medio: productData.custoMedio,
        preco_venda: productData.precoVendaSugerido,
        status: productData.status,
      };
      await criarProduto.mutateAsync(insertData);
    }
  };

  const handleEdit = (product: Produto) => {
    setEditingProduct(product);
    setFormModalOpen(true);
  };

  const handleView = (product: Produto) => {
    setSelectedProduct(product);
    setDetailModalOpen(true);
  };

  const handleDelete = (product: Produto) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const convertToModalProduct = (product: Produto | null) => {
    if (!product) return null;
    return {
      id: product.id,
      codigoInterno: product.sku,
      nome: product.nome,
      descricao: product.descricao || "",
      categoria: product.categoria || "",
      subcategoria: product.subcategoria,
      unidadeMedida: product.unidade_medida,
      ncm: product.ncm || "",
      cfopVenda: product.cfop_venda,
      cfopCompra: product.cfop_compra,
      fornecedorPrincipalNome: product.fornecedor_nome,
      custoMedio: product.custo_medio,
      precoVendaSugerido: product.preco_venda,
      canais: [],
      status: product.status as "ativo" | "inativo",
      observacoes: "",
      dataCadastro: product.created_at?.split("T")[0] || "",
      dataAtualizacao: product.updated_at?.split("T")[0] || "",
    };
  };

  const getTipoBadge = (tipo: string) => {
    const tipos: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      unico: { label: "Único", variant: "default" },
      variation_parent: { label: "Pai", variant: "secondary" },
      variation_child: { label: "Variação", variant: "outline" },
      kit: { label: "Kit", variant: "secondary" },
    };
    const config = tipos[tipo] || tipos.unico;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <Button variant="outline" onClick={() => setExportModalOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button onClick={() => { setEditingProduct(null); setFormModalOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </div>
          </div>

          <ProdutoImportJobsPanel empresaId={empresaSelecionada} />

          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <div className="text-2xl font-bold">{resumo.total}</div>
                    )}
                    <div className="text-sm text-muted-foreground">Total de Produtos</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">{resumo.ativos}</div>
                )}
                <div className="text-sm text-muted-foreground">Produtos Ativos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{resumo.unicos}</div>
                )}
                <div className="text-sm text-muted-foreground">Produtos Únicos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{resumo.kits}</div>
                )}
                <div className="text-sm text-muted-foreground">Kits</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-4 flex-wrap">
                <Select value={empresaSelecionada} onValueChange={setEmpresaId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, SKU ou NCM..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {CATEGORIAS_PRODUTO.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="unico">Único</SelectItem>
                    <SelectItem value="variation_parent">Pai de Variação</SelectItem>
                    <SelectItem value="variation_child">Variação</SelectItem>
                    <SelectItem value="kit">Kit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhum produto encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                          <TableCell>
                            <div className="font-medium max-w-64 truncate">{product.nome}</div>
                          </TableCell>
                          <TableCell>{getTipoBadge(product.tipo)}</TableCell>
                          <TableCell>{product.categoria || "-"}</TableCell>
                          <TableCell className="font-mono">{product.ncm || "-"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.custo_medio)}</TableCell>
                          <TableCell>
                            <Badge variant={product.status === "ativo" ? "default" : "secondary"}>
                              {product.status === "ativo" ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleView(product)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(product)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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
        product={convertToModalProduct(editingProduct)} 
        onSave={handleSaveProduct} 
      />
      
      <ProductDetailModal 
        open={detailModalOpen} 
        onOpenChange={setDetailModalOpen} 
        product={convertToModalProduct(selectedProduct)} 
        salesHistory={[]} 
        purchaseHistory={[]} 
      />

      <ImportarProdutosModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => refetch()}
      />

      <ExportarProdutosModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
      />

      <ExcluirProdutoModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        produtoId={productToDelete?.id || null}
        produtoNome={productToDelete?.nome || ""}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
