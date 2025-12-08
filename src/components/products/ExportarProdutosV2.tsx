import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Package, Layers, Box, Database, Map } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos } from "@/hooks/useProdutos";
import { useEstoque } from "@/hooks/useEstoque";
import { useMarketplaceSkuMappings } from "@/hooks/useMarketplaceSkuMappings";
import { toast } from "sonner";
import { exportarProdutosV2 } from "@/lib/produtos-import-export-v2";

export function ExportarProdutosV2() {
  const { empresas = [] } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("todas");
  const [formato, setFormato] = useState<'csv' | 'xlsx'>('xlsx');
  const [incluirEstoque, setIncluirEstoque] = useState(true);
  const [incluirMapeamentos, setIncluirMapeamentos] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [isExporting, setIsExporting] = useState(false);

  const { produtos = [], isLoading } = useProdutos({
    empresaId: empresaId !== 'todas' ? empresaId : undefined,
  });

  const { estoques = [] } = useEstoque({
    empresaId: empresaId !== 'todas' ? empresaId : undefined,
  });

  const { mappings: mapeamentos = [] } = useMarketplaceSkuMappings({
    empresaId: empresaId !== 'todas' ? empresaId : undefined,
  });

  // Filtrar por tipo
  const produtosFiltrados = produtos.filter(p => {
    if (filtroTipo === "todos") return true;
    return p.tipo === filtroTipo;
  });

  // Contar por tipo
  const contagem = {
    total: produtos.length,
    unico: produtos.filter(p => p.tipo === 'unico').length,
    variacao: produtos.filter(p => p.tipo === 'variation_parent' || p.tipo === 'variation_child').length,
    kit: produtos.filter(p => p.tipo === 'kit').length,
  };

  const handleExportar = () => {
    if (produtosFiltrados.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }

    setIsExporting(true);

    try {
      // Preparar dados de estoque
      const estoquesFormatados = incluirEstoque ? estoques.map(e => ({
        produto_id: e.produto_id,
        armazem_codigo: e.armazem?.codigo || '',
        quantidade: e.quantidade,
      })) : undefined;

      // Preparar mapeamentos
      const mapeamentosFormatados = incluirMapeamentos ? mapeamentos.map(m => ({
        produto_id: m.produto_id,
        canal: m.canal,
        anuncio_id: m.anuncio_id || undefined,
        variante_id: m.variante_id || undefined,
        nome_loja: m.nome_loja || undefined,
      })) : undefined;

      const blob = exportarProdutosV2(
        produtosFiltrados, 
        formato,
        estoquesFormatados,
        mapeamentosFormatados
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const tipoSuffix = filtroTipo !== 'todos' ? `_${filtroTipo}` : '';
      a.download = `produtos${tipoSuffix}_${timestamp}.${formato}`;
      
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`${produtosFiltrados.length} produtos exportados com sucesso`);
    } catch (err) {
      console.error("Erro ao exportar:", err);
      toast.error("Erro ao exportar produtos");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportar Produtos
        </CardTitle>
        <CardDescription>
          Exporte produtos com estoque, mapeamentos e estrutura completa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Empresa */}
        <div className="space-y-2">
          <Label>Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome_fantasia || e.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resumo por tipo */}
        <div className="grid grid-cols-4 gap-3">
          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${filtroTipo === 'todos' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            onClick={() => setFiltroTipo('todos')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">Todos</span>
            </div>
            <div className="text-2xl font-bold">{contagem.total}</div>
          </div>
          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${filtroTipo === 'unico' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            onClick={() => setFiltroTipo('unico')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">Únicos</span>
            </div>
            <div className="text-2xl font-bold">{contagem.unico}</div>
          </div>
          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${filtroTipo === 'variacao' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            onClick={() => setFiltroTipo('variacao')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4" />
              <span className="text-sm font-medium">Variações</span>
            </div>
            <div className="text-2xl font-bold">{contagem.variacao}</div>
          </div>
          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${filtroTipo === 'kit' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            onClick={() => setFiltroTipo('kit')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Box className="h-4 w-4" />
              <span className="text-sm font-medium">Kits</span>
            </div>
            <div className="text-2xl font-bold">{contagem.kit}</div>
          </div>
        </div>

        {/* Formato */}
        <div className="space-y-2">
          <Label>Formato</Label>
          <RadioGroup value={formato} onValueChange={(v) => setFormato(v as 'csv' | 'xlsx')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="xlsx" id="xlsx" />
              <Label htmlFor="xlsx" className="font-normal cursor-pointer">
                Excel (.xlsx) - Recomendado
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="csv" id="csv" />
              <Label htmlFor="csv" className="font-normal cursor-pointer">
                CSV (.csv)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Opções */}
        <div className="space-y-3 border-t pt-4">
          <Label>Incluir na exportação</Label>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="incluirEstoque" 
              checked={incluirEstoque}
              onCheckedChange={(checked) => setIncluirEstoque(checked as boolean)}
            />
            <Label htmlFor="incluirEstoque" className="font-normal cursor-pointer flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Estoque por armazém
              {estoques.length > 0 && (
                <Badge variant="secondary" className="text-xs">{estoques.length} registros</Badge>
              )}
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="incluirMapeamentos" 
              checked={incluirMapeamentos}
              onCheckedChange={(checked) => setIncluirMapeamentos(checked as boolean)}
            />
            <Label htmlFor="incluirMapeamentos" className="font-normal cursor-pointer flex items-center gap-2">
              <Map className="h-4 w-4 text-muted-foreground" />
              Mapeamentos marketplace
              {mapeamentos.length > 0 && (
                <Badge variant="secondary" className="text-xs">{mapeamentos.length} mapeamentos</Badge>
              )}
            </Label>
          </div>
        </div>

        {/* Resumo final */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold">{produtosFiltrados.length}</div>
              <div className="text-sm text-muted-foreground">
                produtos serão exportados
              </div>
            </div>
            <Button 
              onClick={handleExportar} 
              disabled={isExporting || isLoading || produtosFiltrados.length === 0}
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exportando..." : "Exportar"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
