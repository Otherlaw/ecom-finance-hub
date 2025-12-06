import { useState, useMemo } from "react";
import { Link2, Search, Trash2, Package, Store, AlertCircle, Check, X, Upload, RefreshCw, Loader2 } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketplaceSkuMappings, MarketplaceSkuMapping } from "@/hooks/useMarketplaceSkuMappings";
import { useProdutoSkuMap, ProdutoSkuMap } from "@/hooks/useProdutoSkuMap";
import { useProdutos } from "@/hooks/useProdutos";
import { useProdutoSkus } from "@/hooks/useProdutoSkus";
import { useEmpresas } from "@/hooks/useEmpresas";
import { ImportarMapeamentoUpsellerModal } from "@/components/products/ImportarMapeamentoUpsellerModal";
import { backfillItensNaoMapeados, limparCacheMapeamentosPorEmpresa } from "@/lib/marketplace-sku-resolver";
import { toast } from "sonner";

const CANAIS_MARKETPLACE = [
  { id: "mercado_livre", nome: "Mercado Livre" },
  { id: "mercado_pago", nome: "Mercado Pago" },
  { id: "shopee", nome: "Shopee" },
  { id: "shein", nome: "Shein" },
  { id: "tiktok_shop", nome: "TikTok Shop" },
];

export default function MapeamentosMarketplace() {
  const { empresas } = useEmpresas();
  const empresaDefault = empresas[0]?.id || "";
  
  const [empresaId, setEmpresaId] = useState<string>(empresaDefault || "");
  const [canalFilter, setCanalFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [importUpsellerOpen, setImportUpsellerOpen] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);

  // Modal de edição
  const [editingMapping, setEditingMapping] = useState<MarketplaceSkuMapping | null>(null);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>("");
  const [selectedSkuId, setSelectedSkuId] = useState<string>("");

  const { mappings, isLoading, criarOuAtualizarMapping, removerMapping } = useMarketplaceSkuMappings({
    empresaId: empresaId || undefined,
    canal: canalFilter !== "todos" ? canalFilter : undefined,
  });

  const { produtos } = useProdutos({ empresaId: empresaId || undefined, status: "ativo" });
  const { skus } = useProdutoSkus({ empresaId: empresaId || undefined });

  // Atualizar empresaId quando empresas carregarem
  useMemo(() => {
    if (!empresaId && empresas.length > 0) {
      setEmpresaId(empresas[0].id);
    }
  }, [empresas, empresaId]);

  // Filtrar mapeamentos
  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      // Filtro de status
      if (statusFilter === "mapeados" && !m.produto_id && !m.sku_id) return false;
      if (statusFilter === "pendentes" && (m.produto_id || m.sku_id)) return false;

      // Filtro de busca
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchSku = m.sku_marketplace.toLowerCase().includes(search);
        const matchNome = m.nome_produto_marketplace?.toLowerCase().includes(search);
        const matchProduto = m.produto?.nome?.toLowerCase().includes(search);
        const matchCodigo = m.produto?.codigo_interno?.toLowerCase().includes(search);
        if (!matchSku && !matchNome && !matchProduto && !matchCodigo) return false;
      }

      return true;
    });
  }, [mappings, statusFilter, searchTerm]);

  // Estatísticas
  const stats = useMemo(() => ({
    total: mappings.length,
    mapeados: mappings.filter((m) => m.produto_id || m.sku_id).length,
    pendentes: mappings.filter((m) => !m.produto_id && !m.sku_id).length,
  }), [mappings]);

  // Abrir modal de edição
  const handleEdit = (mapping: MarketplaceSkuMapping) => {
    setEditingMapping(mapping);
    setSelectedProdutoId(mapping.produto_id || "");
    setSelectedSkuId(mapping.sku_id || "");
  };

  // Salvar mapeamento
  const handleSave = async () => {
    if (!editingMapping) return;

    try {
      await criarOuAtualizarMapping.mutateAsync({
        empresaId: editingMapping.empresa_id,
        canal: editingMapping.canal,
        skuMarketplace: editingMapping.sku_marketplace,
        produtoId: selectedProdutoId || null,
        skuId: selectedSkuId || null,
        nomeProdutoMarketplace: editingMapping.nome_produto_marketplace,
        mapeadoAutomaticamente: false,
      });
      toast.success("Mapeamento salvo com sucesso");
      setEditingMapping(null);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  // Remover mapeamento
  const handleRemove = async (id: string) => {
    if (!confirm("Deseja realmente remover este mapeamento?")) return;
    await removerMapping.mutateAsync(id);
  };

  // Executar backfill de itens antigos
  const handleBackfill = async () => {
    if (!empresaId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }
    
    const canal = canalFilter !== "todos" ? canalFilter : "mercado_livre";
    
    setIsBackfilling(true);
    try {
      // Limpar cache antes de backfill para pegar mapeamentos mais recentes
      limparCacheMapeamentosPorEmpresa(empresaId, canal);
      
      const resultado = await backfillItensNaoMapeados(empresaId, canal, 5000);
      
      if (resultado.atualizados > 0) {
        toast.success(`Backfill concluído: ${resultado.atualizados} itens vinculados`);
      } else if (resultado.semMapeamento > 0) {
        toast.info(`Nenhum item atualizado. ${resultado.semMapeamento} itens sem mapeamento disponível.`);
      } else {
        toast.info("Não há itens pendentes para vincular");
      }
    } catch (error) {
      console.error("Erro no backfill:", error);
      toast.error("Erro ao executar vinculação retroativa");
    } finally {
      setIsBackfilling(false);
    }
  };

  // SKUs do produto selecionado
  const skusDoProduto = useMemo(() => {
    if (!selectedProdutoId) return [];
    return skus.filter((s) => s.produto_id === selectedProdutoId);
  }, [selectedProdutoId, skus]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Link2 className="h-6 w-6 text-primary" />
                Mapeamentos MLB ↔ SKU
              </h1>
              <p className="text-muted-foreground">
                Vincule os códigos de anúncio do marketplace aos produtos internos
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleBackfill}
                disabled={isBackfilling || !empresaId}
              >
                {isBackfilling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Vincular Itens Antigos
              </Button>
              <Button onClick={() => setImportUpsellerOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar Upseller
              </Button>
            </div>
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Store className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Total de MLBs</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Check className="h-8 w-8 text-success" />
                  <div>
                    <div className="text-2xl font-bold text-success">{stats.mapeados}</div>
                    <div className="text-sm text-muted-foreground">Mapeados</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-warning" />
                  <div>
                    <div className="text-2xl font-bold text-warning">{stats.pendentes}</div>
                    <div className="text-sm text-muted-foreground">Pendentes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-4">
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={canalFilter} onValueChange={setCanalFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Canais</SelectItem>
                    {CANAIS_MARKETPLACE.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="mapeados">Mapeados</SelectItem>
                    <SelectItem value="pendentes">Pendentes</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por MLB, nome ou produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredMappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum mapeamento encontrado. Importe transações de marketplace para criar mapeamentos automaticamente.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead>MLB / SKU Marketplace</TableHead>
                      <TableHead>Nome no Marketplace</TableHead>
                      <TableHead>Produto Interno</TableHead>
                      <TableHead>SKU Interno</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {CANAIS_MARKETPLACE.find((c) => c.id === mapping.canal)?.nome || mapping.canal}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {mapping.sku_marketplace}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                          {mapping.nome_produto_marketplace || "-"}
                        </TableCell>
                        <TableCell>
                          {mapping.produto ? (
                            <div>
                              <div className="font-medium">{mapping.produto.nome}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {mapping.produto.codigo_interno}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mapping.sku ? (
                            <Badge variant="secondary" className="font-mono">
                              {mapping.sku.codigo_sku}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mapping.produto_id || mapping.sku_id ? (
                            <Badge variant="default" className="bg-success">
                              <Check className="h-3 w-3 mr-1" />
                              Mapeado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-warning/20 text-warning">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(mapping)}
                            >
                              <Link2 className="h-4 w-4 mr-1" />
                              Vincular
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemove(mapping.id)}
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

      {/* Modal de Edição */}
      <Dialog open={!!editingMapping} onOpenChange={(open) => !open && setEditingMapping(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Vincular Produto
            </DialogTitle>
            <DialogDescription>
              Vincule o código do marketplace a um produto interno
            </DialogDescription>
          </DialogHeader>

          {editingMapping && (
            <div className="space-y-4 py-4">
              {/* Informações do Marketplace */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Canal:</span>
                  <Badge variant="outline">
                    {CANAIS_MARKETPLACE.find((c) => c.id === editingMapping.canal)?.nome}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">MLB / SKU:</span>
                  <span className="font-mono">{editingMapping.sku_marketplace}</span>
                </div>
                {editingMapping.nome_produto_marketplace && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Nome:</span>
                    <p className="mt-1 text-sm">{editingMapping.nome_produto_marketplace}</p>
                  </div>
                )}
              </div>

              {/* Seleção de Produto */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Produto Interno</label>
                <Select value={selectedProdutoId} onValueChange={(v) => {
                  setSelectedProdutoId(v);
                  setSelectedSkuId(""); // Reset SKU ao mudar produto
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{p.nome}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            ({p.codigo_interno})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seleção de SKU (se produto selecionado) */}
              {selectedProdutoId && skusDoProduto.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">SKU / Variação (opcional)</label>
                  <Select value={selectedSkuId} onValueChange={setSelectedSkuId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum (usar produto)</SelectItem>
                      {skusDoProduto.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="font-mono">{s.codigo_sku}</span>
                          {s.variacao && Object.keys(s.variacao).length > 0 && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({Object.values(s.variacao).join(", ")})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMapping(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={criarOuAtualizarMapping.isPending}>
              {criarOuAtualizarMapping.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportarMapeamentoUpsellerModal
        open={importUpsellerOpen}
        onOpenChange={setImportUpsellerOpen}
        onSuccess={() => {
          // Recarregar dados
        }}
      />
    </div>
  );
}
