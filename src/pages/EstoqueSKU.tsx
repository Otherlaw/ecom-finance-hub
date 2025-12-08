import { useState, useMemo } from 'react';
import { Package, Search, AlertTriangle, TrendingDown, TrendingUp, ArrowUpDown } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEstoque } from '@/hooks/useEstoque';
import { useProdutos } from '@/hooks/useProdutos';
import { useCentrosCusto } from '@/hooks/useCentrosCusto';
import { CentroCustoSelect } from '@/components/CentroCustoSelect';
import { AjusteEstoqueModal } from '@/components/estoque/AjusteEstoqueModal';

export default function EstoqueSKU() {
  const { estoques: estoque, isLoading: isLoadingEstoque, refetch } = useEstoque();
  const { produtos, isLoading: isLoadingProdutos } = useProdutos();
  const { centrosFlat: centrosCusto, isLoading: isLoadingCentros } = useCentrosCusto();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [centroCustoFilter, setCentroCustoFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);

  const isLoading = isLoadingEstoque || isLoadingProdutos || isLoadingCentros;

  // Criar mapa de produtos e centros de custo para lookup rápido
  const produtosMap = useMemo(() => {
    const map = new Map<string, typeof produtos[0]>();
    produtos.forEach(p => map.set(p.id, p));
    return map;
  }, [produtos]);

  const centrosCustoMap = useMemo(() => {
    const map = new Map<string, typeof centrosCusto[0]>();
    centrosCusto.forEach(c => map.set(c.id, c));
    return map;
  }, [centrosCusto]);

  // Combinar estoque com dados de produto e centro de custo
  const estoqueEnriquecido = useMemo(() => {
    return estoque.map(e => ({
      ...e,
      produto: produtosMap.get(e.produto_id),
      centroCusto: centrosCustoMap.get(e.armazem_id),
    }));
  }, [estoque, produtosMap, centrosCustoMap]);

  // Filtrar estoque
  const filteredEstoque = useMemo(() => {
    return estoqueEnriquecido.filter(e => {
      // Filtro de busca
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const produtoNome = e.produto?.nome?.toLowerCase() || '';
        const produtoSku = e.produto?.sku?.toLowerCase() || '';
        if (!produtoNome.includes(search) && !produtoSku.includes(search)) {
          return false;
        }
      }
      
      // Filtro de centro de custo
      if (centroCustoFilter && e.armazem_id !== centroCustoFilter) {
        return false;
      }
      
      // Filtro de status
      if (statusFilter === 'baixo' && e.quantidade > (e.estoque_minimo || 0)) {
        return false;
      }
      if (statusFilter === 'zerado' && e.quantidade > 0) {
        return false;
      }
      if (statusFilter === 'disponivel' && e.quantidade <= 0) {
        return false;
      }
      
      return true;
    });
  }, [estoqueEnriquecido, searchTerm, centroCustoFilter, statusFilter]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const totalItens = estoqueEnriquecido.length;
    const itensZerados = estoqueEnriquecido.filter(e => e.quantidade <= 0).length;
    const itensBaixos = estoqueEnriquecido.filter(e => 
      e.quantidade > 0 && e.quantidade <= (e.estoque_minimo || 0)
    ).length;
    const valorTotal = estoqueEnriquecido.reduce((acc, e) => 
      acc + (e.quantidade * e.custo_medio), 0
    );
    
    return { totalItens, itensZerados, itensBaixos, valorTotal };
  }, [estoqueEnriquecido]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (quantidade: number, estoqueMinimo: number | null) => {
    if (quantidade <= 0) {
      return <Badge variant="destructive">Zerado</Badge>;
    }
    if (estoqueMinimo && quantidade <= estoqueMinimo) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Baixo</Badge>;
    }
    return <Badge variant="default">Disponível</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando estoque...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Estoque por SKU</h1>
              <p className="text-muted-foreground">Controle de estoque por produto e centro de custo</p>
            </div>
            <Button onClick={() => setAjusteModalOpen(true)}>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Ajustar Estoque
            </Button>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{stats.totalItens}</div>
                    <div className="text-sm text-muted-foreground">Total de SKUs</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</div>
                    <div className="text-sm text-muted-foreground">Valor em Estoque</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-yellow-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats.itensBaixos}</div>
                    <div className="text-sm text-muted-foreground">Estoque Baixo</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats.itensZerados}</div>
                    <div className="text-sm text-muted-foreground">Estoque Zerado</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros e Tabela */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <CentroCustoSelect
                  value={centroCustoFilter}
                  onValueChange={setCentroCustoFilter}
                  placeholder="Todos os Centros de Custo"
                  className="w-56"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="baixo">Estoque Baixo</SelectItem>
                    <SelectItem value="zerado">Zerado</SelectItem>
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
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Custo Médio</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEstoque.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">
                        {item.produto?.sku || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.produto?.nome || 'Produto não encontrado'}</div>
                        {item.produto?.categoria && (
                          <div className="text-xs text-muted-foreground">
                            {item.produto.categoria}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{item.centroCusto?.nome || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.quantidade} {item.produto?.unidade_medida || 'un'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.custo_medio)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.quantidade * item.custo_medio)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.quantidade, item.estoque_minimo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredEstoque.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum item de estoque encontrado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <AjusteEstoqueModal
        open={ajusteModalOpen}
        onOpenChange={setAjusteModalOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
