import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Truck, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLogisticaPlataformaConfig, CANAIS_LOGISTICA, TIPOS_ENVIO_FLEX } from "@/hooks/useLogisticaPlataformaConfig";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LABEL_TIPO: Record<string, string> = {
  flex: "Flex",
  flex_turbo: "Flex Turbo",
};

const LABEL_CANAL: Record<string, string> = {
  "Mercado Livre": "Mercado Livre",
  "Shopee": "Shopee",
};

export function LogisticaFlexConfig() {
  const { empresas, isLoading: loadingEmpresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("");

  // Auto-selecionar se só tiver 1 empresa
  useEffect(() => {
    if (!loadingEmpresas && empresas.length === 1 && !empresaId) {
      setEmpresaId(empresas[0].id);
    }
  }, [loadingEmpresas, empresas, empresaId]);

  const { configs, isLoading, salvarTodos } = useLogisticaPlataformaConfig(empresaId || null);

  // Estado local: { "Mercado Livre_flex": "0.00", ... }
  const makeKey = (canal: string, tipo: string) => `${canal}_${tipo}`;

  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Inicializar com valores do banco
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const canal of CANAIS_LOGISTICA) {
      for (const tipo of TIPOS_ENVIO_FLEX) {
        const row = configs.find(c => c.canal === canal && c.tipo_envio === tipo);
        initial[makeKey(canal, tipo)] = String(row?.custo ?? 0);
      }
    }
    setValores(initial);
  }, [configs]);

  const handleSalvar = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      const rows = CANAIS_LOGISTICA.flatMap(canal =>
        TIPOS_ENVIO_FLEX.map(tipo => ({
          canal,
          tipo_envio: tipo,
          custo: parseFloat(valores[makeKey(canal, tipo)] || "0") || 0,
        }))
      );
      await salvarTodos.mutateAsync(rows);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Custo Operacional de Logística Flex</h3>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              Custo interno da sua operação para envios Flex e Flex Turbo por plataforma
              (ex: motoboy, embalagem). Esse valor é descontado da margem de contribuição
              além do frete cobrado. O bônus por envio pago pelo ML já é somado como crédito.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Seletor de empresa */}
      {empresas.length > 1 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresas.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome_fantasia || e.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!empresaId ? (
        <p className="text-sm text-muted-foreground">Selecione uma empresa para configurar.</p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      ) : (
        <>
          {CANAIS_LOGISTICA.map((canal, i) => (
            <div key={canal}>
              {i > 0 && <Separator className="my-4" />}
              <div className="space-y-3">
                <p className="text-sm font-medium">{LABEL_CANAL[canal]}</p>
                <div className="grid grid-cols-2 gap-4">
                  {TIPOS_ENVIO_FLEX.map(tipo => {
                    const key = makeKey(canal, tipo);
                    return (
                      <div key={tipo} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          {LABEL_TIPO[tipo]} (R$)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            R$
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={valores[key] ?? "0"}
                            onChange={e =>
                              setValores(prev => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder="0.00"
                            className="pl-9"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            Configure 0 para plataformas/tipos que não utiliza.
          </p>

          <Button
            onClick={handleSalvar}
            disabled={saving || !empresaId}
            size="sm"
            className="w-full"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Custos de Logística
          </Button>
        </>
      )}
    </div>
  );
}
