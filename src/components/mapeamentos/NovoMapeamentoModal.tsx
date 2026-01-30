import { useState } from "react";
import { Link2, Package, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProdutos } from "@/hooks/useProdutos";
import { useMarketplaceSkuMappings } from "@/hooks/useMarketplaceSkuMappings";
import { toast } from "sonner";

const CANAIS_MARKETPLACE = [
  { id: "mercado_livre", nome: "Mercado Livre" },
  { id: "mercado_pago", nome: "Mercado Pago" },
  { id: "shopee", nome: "Shopee" },
  { id: "shein", nome: "Shein" },
  { id: "tiktok_shop", nome: "TikTok Shop" },
];

interface NovoMapeamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onSuccess?: () => void;
}

export function NovoMapeamentoModal({
  open,
  onOpenChange,
  empresaId,
  onSuccess,
}: NovoMapeamentoModalProps) {
  const [canal, setCanal] = useState("mercado_livre");
  const [skuMarketplace, setSkuMarketplace] = useState("");
  const [anuncioId, setAnuncioId] = useState("");
  const [nomeAnuncio, setNomeAnuncio] = useState("");
  const [produtoId, setProdutoId] = useState("");

  const { produtos } = useProdutos({ empresaId, status: "ativo" });
  const { criarOuAtualizarMapping } = useMarketplaceSkuMappings({ empresaId });

  const handleSave = async () => {
    if (!skuMarketplace.trim()) {
      toast.error("Informe o SKU do Marketplace");
      return;
    }
    if (!produtoId) {
      toast.error("Selecione um produto interno");
      return;
    }

    try {
      await criarOuAtualizarMapping.mutateAsync({
        empresaId,
        canal,
        skuMarketplace: skuMarketplace.trim(),
        anuncioId: anuncioId.trim() || null,
        nomeAnuncio: nomeAnuncio.trim() || null,
        produtoId,
        mapeadoAutomaticamente: false,
      });
      toast.success("Mapeamento criado com sucesso!");
      // Limpar form
      setSkuMarketplace("");
      setAnuncioId("");
      setNomeAnuncio("");
      setProdutoId("");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar mapeamento:", error);
      toast.error("Erro ao criar mapeamento");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Novo Mapeamento MLB ↔ SKU
          </DialogTitle>
          <DialogDescription>
            Vincule um código de anúncio do marketplace a um produto interno (sem usar API)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Canal */}
          <div className="space-y-2">
            <Label>Canal do Marketplace</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                {CANAIS_MARKETPLACE.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      {c.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SKU Marketplace */}
          <div className="space-y-2">
            <Label htmlFor="sku-marketplace">
              SKU do Marketplace <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sku-marketplace"
              placeholder="Ex: MLB1234567890, SHOPEE-SKU-001"
              value={skuMarketplace}
              onChange={(e) => setSkuMarketplace(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Este é o código que aparece nas vendas do marketplace (seller_sku, variation_id, etc)
            </p>
          </div>

          {/* Anúncio ID (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="anuncio-id">
              ID do Anúncio (opcional)
            </Label>
            <Input
              id="anuncio-id"
              placeholder="Ex: MLB1234567890"
              value={anuncioId}
              onChange={(e) => setAnuncioId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              ID do anúncio/listing no marketplace (MLB, Shopee ID, etc)
            </p>
          </div>

          {/* Nome Anúncio (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="nome-anuncio">
              Nome do Anúncio (opcional)
            </Label>
            <Input
              id="nome-anuncio"
              placeholder="Ex: Kit 10 Camisetas Premium Algodão"
              value={nomeAnuncio}
              onChange={(e) => setNomeAnuncio(e.target.value)}
            />
          </div>

          {/* Produto Interno */}
          <div className="space-y-2">
            <Label>
              Produto Interno <span className="text-destructive">*</span>
            </Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto interno" />
              </SelectTrigger>
              <SelectContent>
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[200px]">{p.nome}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({p.sku})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O custo será obtido do custo médio deste produto para cálculo de margem
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={criarOuAtualizarMapping.isPending || !skuMarketplace.trim() || !produtoId}
          >
            {criarOuAtualizarMapping.isPending ? "Salvando..." : "Criar Mapeamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
