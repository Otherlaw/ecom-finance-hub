import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  FileText,
  ShoppingCart,
  Info,
} from "lucide-react";
import { formatCurrency, ICMSRecommendation } from "@/lib/icms-data";

interface ICMSRecommendationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: ICMSRecommendation | null;
  periodo: string;
}

export function ICMSRecommendationModal({
  open,
  onOpenChange,
  recommendation,
  periodo,
}: ICMSRecommendationModalProps) {
  if (!recommendation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Recomendações de ICMS
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-warning mb-4" />
            <p className="text-muted-foreground">
              Ainda não há dados suficientes para calcular recomendações de ICMS.
              Verifique se as vendas e créditos deste período já foram lançados.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const progressPercentage = Math.min(
    (recommendation.totalCreditosCompensaveis / recommendation.icmsDebito) * 100,
    100
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-warning" />
            Recomendações de ICMS
          </DialogTitle>
          <DialogDescription>
            Análise do período: {periodo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Badge */}
          <div className="flex justify-center">
            {recommendation.suficiente ? (
              <Badge className="bg-success/10 text-success border-success/30 gap-2 py-2 px-4 text-base">
                <CheckCircle2 className="h-5 w-5" />
                Créditos Suficientes
              </Badge>
            ) : (
              <Badge className="bg-warning/10 text-warning border-warning/30 gap-2 py-2 px-4 text-base">
                <AlertTriangle className="h-5 w-5" />
                Créditos Insuficientes
              </Badge>
            )}
          </div>

          {/* KPIs Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
              <TrendingDown className="h-6 w-6 mx-auto text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">ICMS Débito</p>
              <p className="text-xl font-bold text-destructive">
                {formatCurrency(recommendation.icmsDebito)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-center">
              <TrendingUp className="h-6 w-6 mx-auto text-success mb-2" />
              <p className="text-sm text-muted-foreground">Créditos Compensáveis</p>
              <p className="text-xl font-bold text-success">
                {formatCurrency(recommendation.totalCreditosCompensaveis)}
              </p>
            </div>
            <div
              className={`p-4 rounded-xl text-center ${
                recommendation.icmsLiquido <= 0
                  ? "bg-success/10 border border-success/20"
                  : "bg-destructive/10 border border-destructive/20"
              }`}
            >
              <FileText
                className={`h-6 w-6 mx-auto mb-2 ${
                  recommendation.icmsLiquido <= 0 ? "text-success" : "text-destructive"
                }`}
              />
              <p className="text-sm text-muted-foreground">ICMS Líquido</p>
              <p
                className={`text-xl font-bold ${
                  recommendation.icmsLiquido <= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {formatCurrency(recommendation.icmsLiquido)}
              </p>
            </div>
          </div>

          {/* Créditos não compensáveis info */}
          {recommendation.totalCreditosNaoCompensaveis > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-blue-700">
                Você também possui <strong>{formatCurrency(recommendation.totalCreditosNaoCompensaveis)}</strong> em créditos não compensáveis (informativos).
              </p>
            </div>
          )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cobertura de créditos compensáveis</span>
              <span className="font-medium">{progressPercentage.toFixed(1)}%</span>
            </div>
            <Progress
              value={progressPercentage}
              className={`h-3 ${
                progressPercentage >= 100 ? "[&>div]:bg-success" : "[&>div]:bg-warning"
              }`}
            />
          </div>

          {/* Recommendation Message */}
          <div
            className={`p-4 rounded-xl ${
              recommendation.suficiente
                ? "bg-success/5 border border-success/20"
                : "bg-warning/5 border border-warning/20"
            }`}
          >
            <div className="flex items-start gap-3">
              <Lightbulb
                className={`h-5 w-5 mt-0.5 ${
                  recommendation.suficiente ? "text-success" : "text-warning"
                }`}
              />
              <p className="text-sm leading-relaxed">{recommendation.mensagem}</p>
            </div>
          </div>

          {/* Additional Recommendations when credits are insufficient */}
          {!recommendation.suficiente && (
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Detalhamento da Recomendação
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">
                    Crédito necessário
                  </p>
                  <p className="text-lg font-semibold text-warning">
                    {formatCurrency(recommendation.valorFaltante)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">
                    Valor em notas necessário
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(recommendation.valorNotasNecessario)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (alíquota média de {recommendation.aliquotaMedia}%)
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <p className="text-sm font-medium text-primary mb-2">
                  💡 Sugestão de Ação
                </p>
                <p className="text-sm text-muted-foreground">
                  Considere adquirir mercadorias com ICMS destacado ou comprar notas de crédito
                  de fornecedores especializados. Priorize fornecedores de estados com alíquota
                  favorável (7% ou 12% dependendo da origem/destino).
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
