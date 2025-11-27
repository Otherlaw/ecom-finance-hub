import { AlertTriangle, Check, X, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ValidationError } from "@/lib/validation";

interface ValidationAlertProps {
  errors: ValidationError[];
  warnings: ValidationError[];
  onDismiss?: () => void;
  showDismiss?: boolean;
}

export function ValidationAlert({ errors, warnings, onDismiss, showDismiss = true }: ValidationAlertProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <Alert className="bg-success/10 border-success/20">
        <Check className="h-4 w-4 text-success" />
        <AlertTitle className="text-success">Validação concluída</AlertTitle>
        <AlertDescription>
          Todos os dados foram validados com sucesso. Nenhum erro ou divergência encontrada.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertTitle>Erros críticos encontrados ({errors.length})</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="text-sm">• {error.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="bg-warning/10 border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Avisos ({warnings.length})</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm text-muted-foreground">• {warning.message}</li>
              ))}
            </ul>
            {showDismiss && onDismiss && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onDismiss}>
                Entendi, continuar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Componente para mostrar regra crítica sobre Tiny
export function TinyWarningBanner() {
  return (
    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
        <div>
          <h4 className="font-semibold text-destructive">Regra de Negócio: Caixa Tiny</h4>
          <p className="text-sm text-muted-foreground mt-1">
            O <strong>Caixa Tiny</strong> é utilizado APENAS para:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• Contas a pagar e pagas</li>
            <li>• Movimentações financeiras</li>
            <li>• Fluxo de caixa operacional</li>
          </ul>
          <p className="text-sm font-medium text-destructive mt-2">
            NUNCA deve ser classificado como receita ou faturamento.
          </p>
        </div>
      </div>
    </div>
  );
}
