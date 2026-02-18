import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Percent, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEmpresaConfigFinanceira } from "@/hooks/useEmpresaConfigFinanceira";

interface ConfiguracaoFinanceiraEmpresaProps {
  empresaId: string;
}

export function ConfiguracaoFinanceiraEmpresa({ empresaId }: ConfiguracaoFinanceiraEmpresaProps) {
  const { configFiscal, isLoading, salvarConfigFiscal } =
    useEmpresaConfigFinanceira(empresaId);

  const [aliquotaImposto, setAliquotaImposto] = useState<string>("6.00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configFiscal) {
      setAliquotaImposto(String(configFiscal.aliquota_imposto_vendas ?? 6));
    }
  }, [configFiscal]);

  const handleSalvar = async () => {
    setSaving(true);
    try {
      await salvarConfigFiscal.mutateAsync({
        empresa_id: empresaId,
        aliquota_imposto_vendas: parseFloat(aliquotaImposto) || 6,
      });
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
        <p className="text-xs text-muted-foreground">
          Usado para calcular o imposto estimado por pedido quando o valor real não está disponível.
          Os custos de logística própria (Flex/Flex Turbo) são configurados em{" "}
          <strong>Configurações → Custos de Logística Própria</strong>.
        </p>
      </div>

      <div className="pt-1">
        <Button onClick={handleSalvar} disabled={saving} size="sm" className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configuração Fiscal
        </Button>
      </div>
    </div>
  );
}
