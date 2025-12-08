import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Check, ChevronsUpDown, Search, Package, Layers, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useProdutos, Produto, ProdutoInsert, TipoProduto } from "@/hooks/useProdutos";
import { CATEGORIAS_PRODUTO, UNIDADES_MEDIDA } from "@/lib/products-data";

interface ProdutoFormModalV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  produto?: Produto | null;
  onSuccess?: () => void;
}

interface KitComponente {
  sku: string;
  quantidade: number;
  nome?: string;
}

interface AtributoVariacao {
  nome: string;
  valores: string[];
}

interface Variacao {
  sku: string;
  atributos: Record<string, string>;
  custo_medio: number;
  preco_venda: number;
}

const TIPOS_PRODUTO = [
  { value: "unico", label: "Produto Único", icon: Box, description: "SKU individual sem variações" },
  { value: "variation_parent", label: "Com Variações", icon: Layers, description: "Produto pai com filhos (cor, tamanho)" },
  { value: "kit", label: "Kit/Combo", icon: Package, description: "Conjunto de produtos (estoque calculado)" },
];

export function ProdutoFormModalV2({
  open,
  onOpenChange,
  empresaId,
  produto,
  onSuccess,
}: ProdutoFormModalV2Props) {
  const { fornecedores } = useFornecedores();
  const { produtos: produtosExistentes, criarProduto, atualizarProduto } = useProdutos({ empresaId });
  
  const isEditing = !!produto;

  // Form state
  const [tipo, setTipo] = useState<TipoProduto>("unico");
  const [sku, setSku] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("un");
  const [ncm, setNcm] = useState("");
  const [cfopVenda, setCfopVenda] = useState("");
  const [cfopCompra, setCfopCompra] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [custoMedio, setCustoMedio] = useState(0);
  const [precoVenda, setPrecoVenda] = useState(0);
  const [pesoKg, setPesoKg] = useState(0);
  const [alturaCm, setAlturaCm] = useState(0);
  const [larguraCm, setLarguraCm] = useState(0);
  const [profundidadeCm, setProfundidadeCm] = useState(0);
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  
  // Variações
  const [atributosVariacao, setAtributosVariacao] = useState<AtributoVariacao[]>([]);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [novoAtributoNome, setNovoAtributoNome] = useState("");
  
  // Kit
  const [kitComponentes, setKitComponentes] = useState<KitComponente[]>([]);
  const [novoComponenteSku, setNovoComponenteSku] = useState("");
  const [novoComponenteQtd, setNovoComponenteQtd] = useState(1);
  
  // Fornecedor search
  const [fornecedorOpen, setFornecedorOpen] = useState(false);
  const [fornecedorSearch, setFornecedorSearch] = useState("");

  const fornecedoresAtivos = useMemo(() => {
    return (fornecedores || []).filter(f => f.status === 'ativo');
  }, [fornecedores]);

  const fornecedoresFiltrados = useMemo(() => {
    if (!fornecedorSearch.trim()) return fornecedoresAtivos;
    const searchLower = fornecedorSearch.toLowerCase();
    return fornecedoresAtivos.filter(f => 
      f.razao_social.toLowerCase().includes(searchLower) ||
      (f.nome_fantasia && f.nome_fantasia.toLowerCase().includes(searchLower)) ||
      (f.cnpj && f.cnpj.includes(fornecedorSearch))
    );
  }, [fornecedoresAtivos, fornecedorSearch]);

  const produtosDisponiveis = useMemo(() => {
    return produtosExistentes.filter(p => 
      p.tipo === "unico" || p.tipo === "variation_child"
    );
  }, [produtosExistentes]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (produto) {
        setTipo(produto.tipo);
        setSku(produto.sku);
        setNome(produto.nome);
        setDescricao(produto.descricao || "");
        setCategoria(produto.categoria || "");
        setSubcategoria(produto.subcategoria || "");
        setUnidadeMedida(produto.unidade_medida);
        setNcm(produto.ncm || "");
        setCfopVenda(produto.cfop_venda || "");
        setCfopCompra(produto.cfop_compra || "");
        setFornecedorNome(produto.fornecedor_nome || "");
        setCustoMedio(produto.custo_medio);
        setPrecoVenda(produto.preco_venda);
        setPesoKg(produto.peso_kg || 0);
        setAlturaCm(produto.altura_cm || 0);
        setLarguraCm(produto.largura_cm || 0);
        setProfundidadeCm(produto.profundidade_cm || 0);
        setStatus(produto.status === "inativo" ? "inativo" : "ativo");
        setKitComponentes(produto.kit_componentes || []);
      } else {
        resetForm();
      }
    }
  }, [open, produto]);

  const resetForm = () => {
    setTipo("unico");
    setSku("");
    setNome("");
    setDescricao("");
    setCategoria("");
    setSubcategoria("");
    setUnidadeMedida("un");
    setNcm("");
    setCfopVenda("");
    setCfopCompra("");
    setFornecedorNome("");
    setCustoMedio(0);
    setPrecoVenda(0);
    setPesoKg(0);
    setAlturaCm(0);
    setLarguraCm(0);
    setProfundidadeCm(0);
    setStatus("ativo");
    setAtributosVariacao([]);
    setVariacoes([]);
    setKitComponentes([]);
  };

  // Gerar variações a partir dos atributos
  const gerarVariacoes = () => {
    if (atributosVariacao.length === 0) return;
    
    const combinar = (arrays: string[][]): string[][] => {
      if (arrays.length === 0) return [[]];
      const [first, ...rest] = arrays;
      const restCombinations = combinar(rest);
      return first.flatMap(item => restCombinations.map(combo => [item, ...combo]));
    };
    
    const valores = atributosVariacao.map(a => a.valores);
    const combinacoes = combinar(valores);
    
    const novasVariacoes: Variacao[] = combinacoes.map((combo, index) => {
      const atributos: Record<string, string> = {};
      atributosVariacao.forEach((attr, i) => {
        atributos[attr.nome] = combo[i];
      });
      
      const sufixo = combo.join("-");
      return {
        sku: `${sku}-${sufixo}`,
        atributos,
        custo_medio: custoMedio,
        preco_venda: precoVenda,
      };
    });
    
    setVariacoes(novasVariacoes);
  };

  const adicionarAtributo = () => {
    if (!novoAtributoNome.trim()) return;
    if (atributosVariacao.some(a => a.nome.toLowerCase() === novoAtributoNome.toLowerCase())) {
      toast.error("Atributo já existe");
      return;
    }
    setAtributosVariacao([...atributosVariacao, { nome: novoAtributoNome, valores: [] }]);
    setNovoAtributoNome("");
  };

  const removerAtributo = (index: number) => {
    const novos = [...atributosVariacao];
    novos.splice(index, 1);
    setAtributosVariacao(novos);
    setVariacoes([]);
  };

  const adicionarValorAtributo = (atributoIndex: number, valor: string) => {
    if (!valor.trim()) return;
    const novos = [...atributosVariacao];
    if (!novos[atributoIndex].valores.includes(valor)) {
      novos[atributoIndex].valores.push(valor);
      setAtributosVariacao(novos);
    }
  };

  const removerValorAtributo = (atributoIndex: number, valorIndex: number) => {
    const novos = [...atributosVariacao];
    novos[atributoIndex].valores.splice(valorIndex, 1);
    setAtributosVariacao(novos);
    setVariacoes([]);
  };

  const adicionarComponenteKit = () => {
    if (!novoComponenteSku.trim()) {
      toast.error("Selecione um produto");
      return;
    }
    
    if (kitComponentes.some(c => c.sku === novoComponenteSku)) {
      toast.error("Produto já adicionado ao kit");
      return;
    }

    const produtoEncontrado = produtosDisponiveis.find(p => p.sku === novoComponenteSku);
    setKitComponentes([
      ...kitComponentes,
      {
        sku: novoComponenteSku,
        quantidade: novoComponenteQtd,
        nome: produtoEncontrado?.nome,
      },
    ]);
    setNovoComponenteSku("");
    setNovoComponenteQtd(1);
  };

  const removerComponenteKit = (sku: string) => {
    setKitComponentes(kitComponentes.filter(c => c.sku !== sku));
  };

  const validate = (): boolean => {
    if (!sku.trim()) {
      toast.error("SKU é obrigatório");
      return false;
    }
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return false;
    }
    if (!categoria) {
      toast.error("Categoria é obrigatória");
      return false;
    }
    
    if (tipo === "kit" && kitComponentes.length === 0) {
      toast.error("Kit precisa ter pelo menos um componente");
      return false;
    }
    
    if (tipo === "variation_parent" && variacoes.length === 0) {
      toast.error("Produto com variações precisa ter pelo menos uma variação gerada");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const baseData: ProdutoInsert = {
        empresa_id: empresaId,
        sku,
        nome,
        descricao: descricao || undefined,
        tipo,
        categoria,
        subcategoria: subcategoria || undefined,
        unidade_medida: unidadeMedida,
        ncm: ncm || undefined,
        cfop_venda: cfopVenda || undefined,
        cfop_compra: cfopCompra || undefined,
        fornecedor_nome: fornecedorNome || undefined,
        custo_medio: custoMedio,
        preco_venda: precoVenda,
        peso_kg: pesoKg,
        altura_cm: alturaCm,
        largura_cm: larguraCm,
        profundidade_cm: profundidadeCm,
        status,
        kit_componentes: tipo === "kit" ? kitComponentes.map(c => ({ sku: c.sku, quantidade: c.quantidade })) : [],
      };

      if (isEditing && produto) {
        await atualizarProduto.mutateAsync({ id: produto.id, ...baseData });
      } else {
        // Criar produto principal
        const result = await criarProduto.mutateAsync(baseData);
        
        // Se for variation_parent, criar as variações como produtos filhos
        if (tipo === "variation_parent" && variacoes.length > 0) {
          for (const variacao of variacoes) {
            await criarProduto.mutateAsync({
              empresa_id: empresaId,
              sku: variacao.sku,
              nome: `${nome} - ${Object.values(variacao.atributos).join(" / ")}`,
              tipo: "variation_child",
              parent_id: result.id,
              atributos_variacao: variacao.atributos,
              custo_medio: variacao.custo_medio,
              preco_venda: variacao.preco_venda,
              categoria,
              unidade_medida: unidadeMedida,
              ncm: ncm || undefined,
              status,
            });
          }
          toast.success(`Produto e ${variacoes.length} variações criados com sucesso`);
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do produto. Campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
            <TabsTrigger value="dimensoes">Dimensões</TabsTrigger>
            {tipo === "variation_parent" && <TabsTrigger value="variacoes">Variações</TabsTrigger>}
            {tipo === "kit" && <TabsTrigger value="kit">Componentes</TabsTrigger>}
          </TabsList>

          <TabsContent value="geral" className="space-y-6 mt-4">
            {/* Tipo de Produto */}
            {!isEditing && (
              <div className="space-y-3">
                <Label>Tipo de Produto *</Label>
                <div className="grid grid-cols-3 gap-3">
                  {TIPOS_PRODUTO.map((t) => (
                    <Card
                      key={t.value}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary",
                        tipo === t.value && "border-primary bg-primary/5"
                      )}
                      onClick={() => setTipo(t.value as TipoProduto)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <t.icon className={cn("h-8 w-8", tipo === t.value ? "text-primary" : "text-muted-foreground")} />
                          <div>
                            <div className="font-medium">{t.label}</div>
                            <div className="text-xs text-muted-foreground">{t.description}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* SKU e Nome */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="Ex: PROD-001"
                  disabled={isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "ativo" | "inativo")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Produto *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo do produto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Descrição detalhada do produto"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_PRODUTO.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <Input
                  value={subcategoria}
                  onChange={(e) => setSubcategoria(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select value={unidadeMedida} onValueChange={setUnidadeMedida}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_MEDIDA.map((um) => (
                      <SelectItem key={um.value} value={um.value}>{um.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fornecedor e Preços */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor Principal</Label>
                <Popover open={fornecedorOpen} onOpenChange={setFornecedorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {fornecedorNome || "Selecionar..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <Input
                        placeholder="Buscar fornecedor..."
                        value={fornecedorSearch}
                        onChange={(e) => setFornecedorSearch(e.target.value)}
                        className="border-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      <div
                        className={cn("flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent", !fornecedorNome && "bg-accent")}
                        onClick={() => { setFornecedorNome(""); setFornecedorOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", !fornecedorNome ? "opacity-100" : "opacity-0")} />
                        Nenhum
                      </div>
                      {fornecedoresFiltrados.map((f) => (
                        <div
                          key={f.id}
                          className={cn("flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent", fornecedorNome === f.razao_social && "bg-accent")}
                          onClick={() => { setFornecedorNome(f.razao_social); setFornecedorOpen(false); setFornecedorSearch(""); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", fornecedorNome === f.razao_social ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{f.nome_fantasia || f.razao_social}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Custo Médio (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={custoMedio || ""}
                  onChange={(e) => setCustoMedio(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoVenda || ""}
                  onChange={(e) => setPrecoVenda(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fiscal" className="space-y-6 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>NCM</Label>
                <Input
                  value={ncm}
                  onChange={(e) => setNcm(e.target.value)}
                  placeholder="00000000"
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label>CFOP Venda</Label>
                <Input
                  value={cfopVenda}
                  onChange={(e) => setCfopVenda(e.target.value)}
                  placeholder="5102"
                />
              </div>
              <div className="space-y-2">
                <Label>CFOP Compra</Label>
                <Input
                  value={cfopCompra}
                  onChange={(e) => setCfopCompra(e.target.value)}
                  placeholder="1102"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dimensoes" className="space-y-6 mt-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={pesoKg || ""}
                  onChange={(e) => setPesoKg(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Altura (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={alturaCm || ""}
                  onChange={(e) => setAlturaCm(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Largura (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={larguraCm || ""}
                  onChange={(e) => setLarguraCm(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Profundidade (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={profundidadeCm || ""}
                  onChange={(e) => setProfundidadeCm(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </TabsContent>

          {tipo === "variation_parent" && (
            <TabsContent value="variacoes" className="space-y-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Atributos de Variação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome do atributo (ex: Cor, Tamanho)"
                      value={novoAtributoNome}
                      onChange={(e) => setNovoAtributoNome(e.target.value)}
                    />
                    <Button onClick={adicionarAtributo}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {atributosVariacao.map((attr, attrIndex) => (
                    <div key={attrIndex} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{attr.nome}</span>
                        <Button variant="ghost" size="icon" onClick={() => removerAtributo(attrIndex)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {attr.valores.map((val, valIndex) => (
                          <Badge key={valIndex} variant="secondary" className="gap-1">
                            {val}
                            <button onClick={() => removerValorAtributo(attrIndex, valIndex)} className="ml-1 hover:text-destructive">×</button>
                          </Badge>
                        ))}
                        <Input
                          className="w-32 h-6 text-sm"
                          placeholder="Novo valor"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              adicionarValorAtributo(attrIndex, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {atributosVariacao.length > 0 && atributosVariacao.every(a => a.valores.length > 0) && (
                    <Button onClick={gerarVariacoes} className="w-full">
                      Gerar Variações
                    </Button>
                  )}

                  {variacoes.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <Label>Variações Geradas ({variacoes.length})</Label>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {variacoes.map((v, i) => (
                          <div key={i} className="flex items-center gap-4 p-2 border rounded bg-muted/30">
                            <span className="font-mono text-sm w-32">{v.sku}</span>
                            <span className="text-sm flex-1">{Object.values(v.atributos).join(" / ")}</span>
                            <Input
                              type="number"
                              className="w-24"
                              value={v.custo_medio}
                              onChange={(e) => {
                                const novas = [...variacoes];
                                novas[i].custo_medio = parseFloat(e.target.value) || 0;
                                setVariacoes(novas);
                              }}
                              placeholder="Custo"
                            />
                            <Input
                              type="number"
                              className="w-24"
                              value={v.preco_venda}
                              onChange={(e) => {
                                const novas = [...variacoes];
                                novas[i].preco_venda = parseFloat(e.target.value) || 0;
                                setVariacoes(novas);
                              }}
                              placeholder="Preço"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {tipo === "kit" && (
            <TabsContent value="kit" className="space-y-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Componentes do Kit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Select value={novoComponenteSku} onValueChange={setNovoComponenteSku}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecionar produto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtosDisponiveis.map((p) => (
                          <SelectItem key={p.id} value={p.sku}>{p.sku} - {p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-24"
                      value={novoComponenteQtd}
                      onChange={(e) => setNovoComponenteQtd(parseInt(e.target.value) || 1)}
                      min={1}
                      placeholder="Qtd"
                    />
                    <Button onClick={adicionarComponenteKit}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {kitComponentes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum componente adicionado ao kit
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {kitComponentes.map((comp) => (
                        <div key={comp.sku} className="flex items-center gap-4 p-3 border rounded bg-muted/30">
                          <span className="font-mono text-sm">{comp.sku}</span>
                          <span className="flex-1 text-sm">{comp.nome || "-"}</span>
                          <Badge variant="secondary">Qtd: {comp.quantidade}</Badge>
                          <Button variant="ghost" size="icon" onClick={() => removerComponenteKit(comp.sku)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={criarProduto.isPending || atualizarProduto.isPending}>
            {isEditing ? "Salvar Alterações" : "Cadastrar Produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
