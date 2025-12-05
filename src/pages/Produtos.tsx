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
import { useProdutos, ProdutoInsert, ProdutoUpdate } from "@/hooks/useProdutos";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Skeleton } from "@/components/ui/skeleton";
import type { Produto } from "@/lib/motor-custos";
import {
  CATEGORIAS_PRODUTO,
  CANAIS_VENDA,
  formatCurrency,
} from "@/lib/products-data";

export default function Produtos() {
  const { empresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [channelFilter, setChannelFilter] = useState<string>("todos");

  // Seleciona primeira empresa automaticamente
  const empresaSelecionada = empresaId || empresas?.[0]?.id || "";

  const { produtos, isLoading, resumo, criarProduto, atualizarProduto } = useProdutos({
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

  // Filtro adicional por canal (front-end)
  const filteredProducts = useMemo(() => {
    if (channelFilter === "todos") return produtos;
    return produtos.filter((product) => 
      product.canais?.some((c) => c.channel === channelFilter)
    );
  }, [produtos, channelFilter]);

  const handleSaveProduct = async (productData: any) => {
    if (!empresaSelecionada) return;

    if (editingProduct) {
      // Atualizar
      const updateData: ProdutoUpdate = {
        id: editingProduct.id,
        codigo_interno: productData.codigoInterno,
        nome: productData.nome,
        descricao: productData.descricao,
        categoria: productData.categoria,
        subcategoria: productData.subcategoria,
        unidade_medida: productData.unidadeMedida,
        ncm: productData.ncm,
        cfop_venda: productData.cfopVenda,
        cfop_compra: productData.cfopCompra,
        fornecedor_principal_nome: productData.fornecedorPrincipalNome,
        custo_medio_atual: productData.custoMedio,
        preco_venda_sugerido: productData.precoVendaSugerido,
        canais: productData.canais,
        status: productData.status,
        observacoes: productData.observacoes,
      };
      await atualizarProduto.mutateAsync(updateData);
    } else {
      // Criar
      const insertData: ProdutoInsert = {
        empresa_id: empresaSelecionada,
        codigo_interno: productData.codigoInterno,
        nome: productData.nome,
        descricao: productData.descricao,
        categoria: productData.categoria,
        subcategoria: productData.subcategoria,
        unidade_medida: productData.unidadeMedida,
        ncm: productData.ncm,
        cfop_venda: productData.cfopVenda,
        cfop_compra: productData.cfopCompra,
        fornecedor_principal_nome: productData.fornecedorPrincipalNome,
        custo_medio_atual: productData.custoMedio,
        preco_venda_sugerido: productData.precoVendaSugerido,
        canais: productData.canais,
        status: productData.status,
        observacoes: productData.observacoes,
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


  // Converter Produto do Supabase para formato do modal
  const convertToModalProduct = (product: Produto | null) => {
    if (!product) return null;
    return {
      id: product.id,
      codigoInterno: product.codigo_interno,
      nome: product.nome,
      descricao: product.descricao || "",
      categoria: product.categoria || "",
      subcategoria: product.subcategoria,
      unidadeMedida: product.unidade_medida,
      ncm: product.ncm || "",
      cfopVenda: product.cfop_venda,
      cfopCompra: product.cfop_compra,
      fornecedorPrincipalNome: product.fornecedor_principal_nome,
      custoMedio: product.custo_medio_atual,
      precoVendaSugerido: product.preco_venda_sugerido,
      canais: product.canais || [],
      status: product.status as "ativo" | "inativo",
      observacoes: product.observacoes,
      dataCadastro: product.created_at?.split("T")[0] || "",
      dataAtualizacao: product.updated_at?.split("T")[0] || "",
    };
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
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

          {/* Stats Cards */}
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
                  <div className="text-2xl font-bold">{resumo.produtosComEstoque}</div>
                )}
                <div className="text-sm text-muted-foreground">Com Estoque</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{formatCurrency(resumo.valorEstoque)}</div>
                )}
                <div className="text-sm text-muted-foreground">Valor em Estoque</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4 flex-wrap">
                {/* Empresa */}
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

                {/* Search */}
                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, SKU ou NCM..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Category */}
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

                {/* Status */}
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

                {/* Channel */}
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {CANAIS_VENDA.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
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
                      <TableHead>Categoria</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
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
                          <TableCell className="font-mono text-sm">{product.codigo_interno}</TableCell>
                          <TableCell>
                            <div className="font-medium max-w-64 truncate">{product.nome}</div>
                            {product.canais && product.canais.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {product.canais.slice(0, 3).map((c) => (
                                  <Badge key={c.channel} variant="outline" className="text-xs">
                                    {CANAIS_VENDA.find((x) => x.id === c.channel)?.nome || c.channel}
                                  </Badge>
                                ))}
                                {product.canais.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{product.canais.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{product.categoria || "-"}</TableCell>
                          <TableCell className="font-mono">{product.ncm || "-"}</TableCell>
                          <TableCell className="text-right">{product.estoque_atual}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.custo_medio_atual)}</TableCell>
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

      {/* Modals */}
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
        onSuccess={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
        }}
      />
    </div>
  );
}
