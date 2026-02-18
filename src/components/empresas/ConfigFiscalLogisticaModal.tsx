import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConfigFiscalLogisticaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: { id: string; nome_fantasia?: string | null; razao_social: string };
}

interface ConfigData {
  aliquota_imposto_vendas: number;
  flex_custo: number;
  flex_turbo_custo: number;
}

const formatCurrencyInput = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const parseCurrencyInput = (value: string): number => {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
};

const formatPercentInput = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const parsePercentInput = (value: string): number => {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
};

export function ConfigFiscalLogisticaModal({
  open,
  onOpenChange,
  empresa,
}: ConfigFiscalLogisticaModalProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [config, setConfig] = useState<ConfigData>({
    aliquota_imposto_vendas: 6,
    flex_custo: 0,
    flex_turbo_custo: 0,
  });

  useEffect(() => {
    if (open && empresa?.id) {
      fetchConfig();
    }
  }, [open, empresa?.id]);

  const fetchConfig = async () => {
    setFetching(true);
    try {
      const [fiscalRes, logisticaRes] = await Promise.all([
        supabase
          .from("empresas_config_fiscal")
          .select("aliquota_imposto_vendas")
          .eq("empresa_id", empresa.id)
          .maybeSingle(),
        supabase
          .from("empresa_logistica_config")
          .select("flex_custo, flex_turbo_custo")
          .eq("empresa_id", empresa.id)
          .maybeSingle(),
      ]);

      setConfig({
        aliquota_imposto_vendas: fiscalRes.data?.aliquota_imposto_vendas ?? 6,
        flex_custo: logisticaRes.data?.flex_custo ?? 0,
        flex_turbo_custo: logisticaRes.data?.flex_turbo_custo ?? 0,
      });
    } catch (err) {
      console.error("Erro ao buscar configurações:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Upsert config fiscal
      const { error: fiscalError } = await supabase
        .from("empresas_config_fiscal")
        .upsert(
          {
            empresa_id: empresa.id,
            aliquota_imposto_vendas: config.aliquota_imposto_vendas,
          },
          { onConflict: "empresa_id" }
        );

      if (fiscalError) throw fiscalError;

      // Upsert config logística
      const { error: logisticaError } = await supabase
        .from("empresa_logistica_config")
        .upsert(
          {
            empresa_id: empresa.id,
            flex_custo: config.flex_custo,
            flex_turbo_custo: config.flex_turbo_custo,
          },
          { onConflict: "empresa_id" }
        );

      if (logisticaError) throw logisticaError;

      toast.success("Configurações salvas com sucesso!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar configurações: " + (err?.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const empresaNome = empresa.nome_fantasia || empresa.razao_social;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações Fiscais e Logísticas</DialogTitle>
          <DialogDescription>
            {empresaNome} — configure alíquotas e custos que impactam o cálculo de margem de contribuição.
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Configuração Fiscal */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Fiscal</h4>
              <div className="space-y-2">
                <Label htmlFor="aliquota_imposto">Alíquota de Imposto sobre Vendas (%)</Label>
                <div className="relative">
                  <Input
                    id="aliquota_imposto"
                    value={formatPercentInput(config.aliquota_imposto_vendas)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        aliquota_imposto_vendas: parsePercentInput(e.target.value),
                      }))
                    }
                    className="pr-8"
                    placeholder="6,00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Imposto médio (DAS, PIS/COFINS, etc.) aplicado sobre o valor bruto das vendas. Padrão: 6%.
                </p>
              </div>
            </div>

            <Separator />

            {/* Configuração Logística FLEX */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Logística FLEX</h4>
              <Alert className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                <AlertDescription className="text-xs text-blue-800 dark:text-blue-300">
                  Para vendas FLEX, o Mercado Livre paga um <strong>bônus por envio</strong> ao vendedor. 
                  Configure abaixo o custo operacional real que você arca com a entrega própria.
                  O cálculo de margem considera: <em>+ bônus ML − custo configurado aqui</em>.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="flex_custo">Custo Flex (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      id="flex_custo"
                      value={formatCurrencyInput(config.flex_custo)}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          flex_custo: parseCurrencyInput(e.target.value),
                        }))
                      }
                      className="pl-10"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flex_turbo_custo">Custo Flex Turbo (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      id="flex_turbo_custo"
                      value={formatCurrencyInput(config.flex_turbo_custo)}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          flex_turbo_custo: parseCurrencyInput(e.target.value),
                        }))
                      }
                      className="pl-10"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Custo médio por entrega própria FLEX ou Flex Turbo (ex: combustível, tempo, embalagem). 
                Use 0 se não quiser descontar.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Configurações
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
