import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Truck, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useLogisticaPlataformaConfig,
  LOGISTICA_CONFIGS,
} from "@/hooks/useLogisticaPlataformaConfig";

// Estado local: mapa "canal|tipo_envio" -> valor string do input
type CustoMap = Record<string, string>;

function chave(canal: string, tipo_envio: string) {
  return `${canal}|${tipo_envio}`;
}

export function LogisticaCustoCard() {
  const { isLoading, salvar, getCusto, empresaId } = useLogisticaPlataformaConfig();
  const [custos, setCustos] = useState<CustoMap>({});
  const [saving, setSaving] = useState(false);

  // Inicializa inputs quando os dados chegam
  useEffect(() => {
    if (!isLoading) {
      const map: CustoMap = {};
      for (const cfg of LOGISTICA_CONFIGS) {
        map[chave(cfg.canal, cfg.tipo_envio)] = String(getCusto(cfg.canal, cfg.tipo_envio));
      }
      setCustos(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const handleChange = (canal: string, tipo_envio: string, value: string) => {
    setCustos((prev) => ({ ...prev, [chave(canal, tipo_envio)]: value }));
  };

  const handleSalvar = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      const items = LOGISTICA_CONFIGS.map((cfg) => ({
        empresa_id: empresaId,
        canal: cfg.canal,
        tipo_envio: cfg.tipo_envio,
        custo: parseFloat(custos[chave(cfg.canal, cfg.tipo_envio)] || "0") || 0,
      }));
      await salvar.mutateAsync(items);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando...
      </div>
    );
  }

  const canais = ["Mercado Livre", "Shopee"] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Custo interno da sua operação para envios próprios (ex: motoboy, embalagem),
          separado por plataforma. Descontado da margem além do frete cobrado pelo marketplace.
        </p>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              O bônus por envio pago pelo Mercado Livre já é somado automaticamente como crédito
              no cálculo da margem. Configure aqui apenas seu custo próprio.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {canais.map((canal, idx) => (
        <div key={canal}>
          {idx > 0 && <Separator className="mb-5" />}
          <h4 className="font-medium text-sm mb-3">{canal}</h4>
          <div className="grid grid-cols-2 gap-4">
            {LOGISTICA_CONFIGS.filter((c) => c.canal === canal).map((cfg) => (
              <div key={cfg.tipo_envio} className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {cfg.label} (R$)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={custos[chave(cfg.canal, cfg.tipo_envio)] ?? "0"}
                    onChange={(e) => handleChange(cfg.canal, cfg.tipo_envio, e.target.value)}
                    placeholder="0.00"
                    className="pl-9"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-1">
        <Button onClick={handleSalvar} disabled={saving || !empresaId} size="sm" className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Custos de Logística
        </Button>
      </div>
    </div>
  );
}
