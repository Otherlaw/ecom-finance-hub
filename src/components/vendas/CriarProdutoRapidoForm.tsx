/**
 * Formulário inline para criar produto rapidamente durante o mapeamento
 * Campos mínimos: SKU, Nome, Custo
 * Suporta tipos: único, variação (variation_child) e kit
 */

import { useState, useMemo } from "react";
import { Plus, Loader2, ArrowLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { toast } from "sonner";

interface CriarProdutoRapidoFormProps {
  empresaId: string;
  skuSugerido?: string | null;
  nomeSugerido?: string | null;
  precoSugerido?: number | null;
  onCancel: () => void;
  onSuccess: (produto: Produto) => void;
}

export function CriarProdutoRapidoForm({
  empresaId,
  skuSugerido,
  nomeSugerido,
  precoSugerido,
  onCancel,
  onSuccess,
}: CriarProdutoRapidoFormProps) {
  const { criarProduto, produtos: todosProdutos } = useProdutos({ empresaId, apenasRaiz: false });

  const [tipo, setTipo] = useState<"unico" | "variation_child" | "kit">("unico");
  const [sku, setSku] = useState(skuSugerido || "");
  const [nome, setNome] = useState(nomeSugerido || "");
  const [custoMedio, setCustoMedio] = useState<number>(0);
  const [salvando, setSalvando] = useState(false);

  // Campos para variação
  const [parentId, setParentId] = useState<string>("");
  const [atributos, setAtributos] = useState<string>("");

  // Campos para kit - agora com produto_id
  const [kitComponentes, setKitComponentes] = useState<{ produto_id: string; sku: string; quantidade: number }[]>([
    { produto_id: "", sku: "", quantidade: 1 },
  ]);

  // Filtrar produtos pai disponíveis
  const produtosPai = todosProdutos.filter(
    (p) => p.tipo === "variation_parent"
  );

  // Produtos disponíveis para componentes de kit (excluir kits e pais)
  const produtosParaKit = useMemo(() => 
    todosProdutos.filter(p => p.tipo !== "variation_parent" && p.tipo !== "kit"),
    [todosProdutos]
  );

  const handleSalvar = async () => {
    if (!sku.trim()) {
      toast.error("SKU é obrigatório");
      return;
    }
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (tipo === "variation_child" && !parentId) {
      toast.error("Selecione o produto pai para a variação");
      return;
    }

    setSalvando(true);
    try {
      // Montar atributos_variacao se for variação
      let atributosObj: Record<string, string> = {};
      if (tipo === "variation_child" && atributos.trim()) {
        atributos.split(",").forEach((par) => {
          const [chave, valor] = par.split(":").map((s) => s.trim());
          if (chave && valor) atributosObj[chave] = valor;
        });
      }

      // Montar kit_componentes se for kit
      let kitComp: { sku: string; quantidade: number }[] = [];
      if (tipo === "kit") {
        kitComp = kitComponentes
          .filter((c) => c.sku.trim() && c.quantidade > 0)
          .map(c => ({ sku: c.sku, quantidade: c.quantidade }));
      }

      const result = await criarProduto.mutateAsync({
        empresa_id: empresaId,
        sku: sku.trim(),
        nome: nome.trim(),
        custo_medio: custoMedio,
        preco_venda: precoSugerido || 0,
        tipo: tipo,
        status: "ativo",
        parent_id: tipo === "variation_child" ? parentId : null,
        atributos_variacao: tipo === "variation_child" ? atributosObj : {},
        kit_componentes: tipo === "kit" ? kitComp : [],
      });

      const novoProduto: Produto = {
        id: result.id,
        empresa_id: result.empresa_id,
        sku: result.sku,
        nome: result.nome,
        descricao: result.descricao,
        tipo: result.tipo as any,
        parent_id: result.parent_id,
        atributos_variacao: tipo === "variation_child" ? atributosObj : {},
        kit_componentes: tipo === "kit" ? kitComp : [],
        ncm: result.ncm,
        cfop_venda: result.cfop_venda,
        cfop_compra: result.cfop_compra,
        situacao_tributaria: result.situacao_tributaria,
        custo_medio: Number(result.custo_medio) || 0,
        preco_venda: Number(result.preco_venda) || 0,
        peso_kg: Number(result.peso_kg) || 0,
        altura_cm: Number(result.altura_cm) || 0,
        largura_cm: Number(result.largura_cm) || 0,
        profundidade_cm: Number(result.profundidade_cm) || 0,
        categoria: result.categoria,
        subcategoria: result.subcategoria,
        marca: result.marca,
        unidade_medida: result.unidade_medida,
        fornecedor_id: result.fornecedor_id,
        fornecedor_nome: result.fornecedor_nome,
        status: result.status as any,
        imagem_url: result.imagem_url,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };

      onSuccess(novoProduto);
    } catch (error) {
      console.error("Erro ao criar produto:", error);
    } finally {
      setSalvando(false);
    }
  };

  const addKitComponente = () => {
    setKitComponentes((prev) => [...prev, { produto_id: "", sku: "", quantidade: 1 }]);
  };

  const removeKitComponente = (idx: number) => {
    setKitComponentes((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectKitProduto = (idx: number, produto: Produto) => {
    setKitComponentes((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, produto_id: produto.id, sku: produto.sku } : c))
    );
  };

  const updateKitQuantidade = (idx: number, value: number) => {
    setKitComponentes((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, quantidade: value } : c))
    );
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-primary/5 border-primary/20">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Plus className="h-4 w-4" />
        Criar Produto Rápido
      </div>

      {/* Seletor de tipo */}
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo de Produto</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unico">Produto Único</SelectItem>
            <SelectItem value="variation_child">Variação de produto existente</SelectItem>
            <SelectItem value="kit">Kit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quick-sku" className="text-xs">
            SKU Interno *
          </Label>
          <Input
            id="quick-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Ex: PROD-001"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quick-custo" className="text-xs">
            Custo Médio (R$)
          </Label>
          <Input
            id="quick-custo"
            type="number"
            step="0.01"
            min="0"
            value={custoMedio || ""}
            onChange={(e) => setCustoMedio(parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quick-nome" className="text-xs">
          Nome do Produto *
        </Label>
        <Input
          id="quick-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do produto"
          className="h-9"
        />
      </div>

      {/* Campos extras para variação */}
      {tipo === "variation_child" && (
        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Produto Pai *</Label>
            {produtosPai.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum produto pai encontrado. Crie primeiro um produto do tipo "Pai de variação" na tela de Produtos.
              </p>
            ) : (
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar produto pai..." />
                </SelectTrigger>
                <SelectContent>
                  {produtosPai.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-atributos" className="text-xs">
              Atributos (ex: Cor: Azul, Tamanho: M)
            </Label>
            <Input
              id="quick-atributos"
              value={atributos}
              onChange={(e) => setAtributos(e.target.value)}
              placeholder="Cor: Azul, Tamanho: M"
              className="h-9"
            />
          </div>
        </div>
      )}

      {/* Campos extras para kit */}
      {tipo === "kit" && (
        <div className="space-y-3 border-t pt-3">
          <Label className="text-xs">Componentes do Kit</Label>
          {kitComponentes.map((comp, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Produto Componente</Label>
                <KitComponenteSelector
                  produtos={produtosParaKit}
                  selectedSku={comp.sku}
                  onSelect={(p) => selectKitProduto(idx, p)}
                />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                <Input
                  type="number"
                  min="1"
                  value={comp.quantidade}
                  onChange={(e) => updateKitQuantidade(idx, parseInt(e.target.value) || 1)}
                  className="h-8 text-xs"
                />
              </div>
              {kitComponentes.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive"
                  onClick={() => removeKitComponente(idx)}
                >
                  X
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addKitComponente} className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Adicionar componente
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={salvando}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSalvar}
          disabled={salvando || !sku.trim() || !nome.trim() || (tipo === "variation_child" && !parentId)}
        >
          {salvando ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Criar e Vincular
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** Seletor de produto com busca para componentes de kit */
function KitComponenteSelector({
  produtos,
  selectedSku,
  onSelect,
}: {
  produtos: Produto[];
  selectedSku: string;
  onSelect: (p: Produto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    if (!busca.trim()) return produtos.slice(0, 20);
    const term = busca.toLowerCase();
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [produtos, busca]);

  const produtoSelecionado = selectedSku
    ? produtos.find((p) => p.sku === selectedSku)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-start text-xs font-normal truncate"
        >
          {produtoSelecionado ? (
            <span className="truncate">{produtoSelecionado.sku} - {produtoSelecionado.nome}</span>
          ) : (
            <span className="text-muted-foreground">Buscar produto...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="flex items-center gap-1 mb-2">
          <Search className="h-3 w-3 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por SKU ou nome..."
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filtrados.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2 text-center">Nenhum produto encontrado</p>
          ) : (
            filtrados.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                  setBusca("");
                }}
              >
                <span className="font-medium">{p.sku}</span>
                <span className="text-muted-foreground ml-1 truncate">— {p.nome}</span>
                {p.custo_medio > 0 && (
                  <span className="text-muted-foreground ml-1">
                    (R$ {p.custo_medio.toFixed(2)})
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
