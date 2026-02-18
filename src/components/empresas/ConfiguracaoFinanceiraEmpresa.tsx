import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Percent, Truck, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEmpresaConfigFinanceira } from "@/hooks/useEmpresaConfigFinanceira";

interface ConfiguracaoFinanceiraEmpresaProps {
  empresaId: string;
}

export function ConfiguracaoFinanceiraEmpresa({ empresaId }: ConfiguracaoFinanceiraEmpresaProps) {
  const { configFiscal, configLogistica, isLoading, salvarConfigFiscal, salvarConfigLogistica } =
    useEmpresaConfigFinanceira(empresaId);

  const [aliquotaImposto, setAliquotaImposto] = useState<string>("6.00");
  const [flexCusto, setFlexCusto] = useState<string>("0.00");
  const [flexTurboCusto, setFlexTurboCusto] = useState<string>("0.00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configFiscal) {
      setAliquotaImposto(String(configFiscal.aliquota_imposto_vendas ?? 6));
    }
  }, [configFiscal]);

  useEffect(() => {
    if (configLogistica) {
      setFlexCusto(String(configLogistica.flex_custo ?? 0));
      setFlexTurboCusto(String(configLogistica.flex_turbo_custo ?? 0));
    }
  }, [configLogistica]);

  const handleSalvar = async () => {
    setSaving(true);
    try {
      await Promise.all([
        salvarConfigFiscal.mutateAsync({
          empresa_id: empresaId,
          aliquota_imposto_vendas: parseFloat(aliquotaImposto) || 6,
        }),
        salvarConfigLogistica.mutateAsync({
          empresa_id: empresaId,
          flex_custo: parseFloat(flexCusto) || 0,
          flex_turbo_custo: parseFloat(flexTurboCusto) || 0,
        }),
      ]);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Imposto Médio */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Imposto Médio sobre Vendas</h4>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Alíquota média utilizada para estimar o imposto sobre vendas no cálculo da
                Margem de Contribuição. Exemplos: Simples Nacional ~6%, Lucro Presumido ~8,65%.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={aliquotaImposto}
              onChange={(e) => setAliquotaImposto(e.target.value)}
              placeholder="6.00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Usado para calcular o imposto estimado por pedido quando o valor real não está disponível.
        </p>
      </div>

      <Separator />

      {/* Custos de Logística Flex */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Custo Operacional de Logística (Flex)</h4>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Custo interno da sua operação para envios Flex e Flex Turbo (ex: motoboy, embalagem).
                Esse valor é descontado da margem além do frete cobrado pelo Mercado Livre.
                O bônus por envio pago pelo ML já é somado automaticamente como crédito.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Custo Flex (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={flexCusto}
                onChange={(e) => setFlexCusto(e.target.value)}
                placeholder="0.00"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Custo Flex Turbo (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={flexTurboCusto}
                onChange={(e) => setFlexTurboCusto(e.target.value)}
                placeholder="0.00"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ex: se você usa motoboy particular com custo de R$ 8,00, configure Flex = 8,00.
        </p>
      </div>

      <div className="pt-1">
        <Button onClick={handleSalvar} disabled={saving} size="sm" className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configurações Financeiras
        </Button>
      </div>
    </div>
  );
}
