/**
 * Página de Gestão de Estoque por SKU (Motor de Estoque V1)
 */

import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw,
  DollarSign,
  Boxes,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import { useProdutoSkus, type ProdutoSKUInsert } from "@/hooks/useProdutoSkus";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos } from "@/hooks/useProdutos";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
};

export default function EstoqueSKU() {
  const { toast } = useToast();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingSku, setEditingSku] = useState<string | null>(null);

  // Dados
  const { empresas, isLoading: loadingEmpresas } = useEmpresas();
  const { produtos, isLoading: loadingProdutos } = useProdutos({ empresaId: empresaId || undefined });
  const { skus, isLoading, resumo, criarSKU, atualizarSKU, inativarSKU, refetch } = useProdutoSkus({
    empresaId: empresaId || undefined,
    busca: busca || undefined,
  });

  // Auto-selecionar primeira empresa
  useMemo(() => {
    if (!empresaId && empresas && empresas.length > 0) {
      setEmpresaId(empresas[0].id);
    }
  }, [empresas, empresaId]);

  // Form state
  const [formData, setFormData] = useState({
    produto_id: "",
    codigo_sku: "",
    variacao: {} as Record<string, string>,
    estoque_atual: 0,
    custo_medio_atual: 0,
    observacoes: "",
  });
  const [variacaoKey, setVariacaoKey] = useState("");
  const [variacaoValue, setVariacaoValue] = useState("");

  const handleAddVariacao = () => {
    if (variacaoKey && variacaoValue) {
      setFormData(prev => ({
        ...prev,
        variacao: { ...prev.variacao, [variacaoKey]: variacaoValue }
      }));
      setVariacaoKey("");
      setVariacaoValue("");
    }
  };

  const handleRemoveVariacao = (key: string) => {
    const { [key]: _, ...rest } = formData.variacao;
    setFormData(prev => ({ ...prev, variacao: rest }));
  };

  const resetForm = () => {
    setFormData({
      produto_id: "",
      codigo_sku: "",
      variacao: {},
      estoque_atual: 0,
      custo_medio_atual: 0,
      observacoes: "",
    });
    setEditingSku(null);
  };

  const handleSubmit = async () => {
    if (!empresaId || !formData.produto_id || !formData.codigo_sku) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a empresa, produto e informe o código SKU.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingSku) {
        await atualizarSKU.mutateAsync({
          id: editingSku,
          dados: {
            codigo_sku: formData.codigo_sku,
            variacao: formData.variacao,
            estoque_atual: formData.estoque_atual,
            custo_medio_atual: formData.custo_medio_atual,
            observacoes: formData.observacoes || undefined,
          },
        });
      } else {
        const input: ProdutoSKUInsert = {
          empresa_id: empresaId,
          produto_id: formData.produto_id,
          codigo_sku: formData.codigo_sku,
          variacao: formData.variacao,
          estoque_atual: formData.estoque_atual,
          custo_medio_atual: formData.custo_medio_atual,
          observacoes: formData.observacoes || undefined,
        };
        await criarSKU.mutateAsync(input);
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      // Toast já é exibido pelo hook
    }
  };

  const handleEdit = (sku: typeof skus[0]) => {
    setFormData({
      produto_id: sku.produto_id,
      codigo_sku: sku.codigo_sku,
      variacao: sku.variacao || {},
      estoque_atual: sku.estoque_atual,
      custo_medio_atual: sku.custo_medio_atual,
      observacoes: sku.observacoes || "",
    });
    setEditingSku(sku.id);
    setShowModal(true);
  };

  const handleInativar = async (id: string) => {
    if (confirm("Tem certeza que deseja inativar este SKU?")) {
      await inativarSKU.mutateAsync(id);
    }
  };

  return (
    <MainLayout title="Estoque por SKU">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Boxes className="h-6 w-6" />
              Estoque por SKU
            </h1>
            <p className="text-muted-foreground">
              Motor de Estoque V1 - Controle de estoque e custo médio por SKU/variação
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo SKU
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingSku ? "Editar SKU" : "Novo SKU"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Produto *</Label>
                    <Select 
                      value={formData.produto_id} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, produto_id: v }))}
                      disabled={!!editingSku}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {(produtos || []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo_interno} - {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Código SKU *</Label>
                    <Input 
                      value={formData.codigo_sku}
                      onChange={(e) => setFormData(prev => ({ ...prev, codigo_sku: e.target.value }))}
                      placeholder="Ex: PROD-001-PRETO-110V"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Variações</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Atributo (ex: cor)"
                        value={variacaoKey}
                        onChange={(e) => setVariacaoKey(e.target.value)}
                        className="flex-1"
                      />
                      <Input 
                        placeholder="Valor (ex: Preto)"
                        value={variacaoValue}
                        onChange={(e) => setVariacaoValue(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={handleAddVariacao}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {Object.keys(formData.variacao).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(formData.variacao).map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveVariacao(k)}>
                            {k}: {v} ✕
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Estoque Inicial</Label>
                      <Input 
                        type="number"
                        value={formData.estoque_atual}
                        onChange={(e) => setFormData(prev => ({ ...prev, estoque_atual: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Custo Médio Inicial (R$)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={formData.custo_medio_atual}
                        onChange={(e) => setFormData(prev => ({ ...prev, custo_medio_atual: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea 
                      value={formData.observacoes}
                      onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={criarSKU.isPending || atualizarSKU.isPending}>
                      {editingSku ? "Salvar" : "Criar SKU"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2 min-w-[200px]">
                <Label>Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(empresas || []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1 min-w-[250px]">
                <Label>Buscar SKU</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por código SKU..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total SKUs</p>
                  <p className="text-2xl font-bold">{resumo.totalSkus}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <Boxes className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estoque Total</p>
                  <p className="text-2xl font-bold">{formatNumber(resumo.estoqueTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor em Estoque</p>
                  <p className="text-2xl font-bold">{formatCurrency(resumo.valorEstoque)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SKUs Ativos</p>
                  <p className="text-2xl font-bold">{resumo.skusAtivos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de SKUs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              SKUs Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : skus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Boxes className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum SKU cadastrado.</p>
                <p className="text-sm">Clique em "Novo SKU" para começar.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Variações</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Custo Médio</TableHead>
                    <TableHead className="text-right">Valor Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skus.map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell className="font-mono font-medium">{sku.codigo_sku}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sku.produto?.nome || "—"}</p>
                          <p className="text-xs text-muted-foreground">{sku.produto?.codigo_interno}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(sku.variacao || {}).map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-xs">
                              {k}: {v}
                            </Badge>
                          ))}
                          {Object.keys(sku.variacao || {}).length === 0 && (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(sku.estoque_atual)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(sku.custo_medio_atual)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sku.estoque_atual * sku.custo_medio_atual)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sku.ativo ? "default" : "secondary"}>
                          {sku.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(sku)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleInativar(sku.id)}
                            disabled={!sku.ativo}
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
    </MainLayout>
  );
}
