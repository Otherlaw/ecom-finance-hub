/**
 * Formulário inline para criar produto rapidamente durante o mapeamento
 * Campos mínimos: SKU, Nome, Custo
 */

import { useState } from "react";
import { Plus, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { criarProduto } = useProdutos({ empresaId });
  
  const [sku, setSku] = useState(skuSugerido || "");
  const [nome, setNome] = useState(nomeSugerido || "");
  const [custoMedio, setCustoMedio] = useState<number>(0);
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (!sku.trim()) {
      toast.error("SKU é obrigatório");
      return;
    }
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSalvando(true);
    try {
      const result = await criarProduto.mutateAsync({
        empresa_id: empresaId,
        sku: sku.trim(),
        nome: nome.trim(),
        custo_medio: custoMedio,
        preco_venda: precoSugerido || 0,
        tipo: "unico",
        status: "ativo",
      });

      // Construir objeto Produto para retornar
      const novoProduto: Produto = {
        id: result.id,
        empresa_id: result.empresa_id,
        sku: result.sku,
        nome: result.nome,
        descricao: result.descricao,
        tipo: result.tipo as any,
        parent_id: result.parent_id,
        atributos_variacao: {},
        kit_componentes: [],
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

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-primary/5 border-primary/20">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Plus className="h-4 w-4" />
        Criar Produto Rápido
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
          disabled={salvando || !sku.trim() || !nome.trim()}
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
