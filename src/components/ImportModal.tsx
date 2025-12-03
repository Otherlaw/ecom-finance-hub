import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, Check, AlertTriangle, X, FileWarning } from "lucide-react";
import { SPREADSHEET_TAB_MAPPING } from "@/lib/validation";
import { toast } from "sonner";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (data: any) => void;
}

type ImportStep = 'upload' | 'preview' | 'validating' | 'complete' | 'error';

interface PreviewData {
  fileName: string;
  fileSize: string;
  detectedTabs: string[];
  recordCount: number;
  warnings: string[];
  errors: string[];
}

export function ImportModal({ open, onOpenChange, onImportComplete }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [progress, setProgress] = useState(0);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error("Tipo de arquivo inválido", {
        description: "Por favor, envie um arquivo Excel (.xlsx, .xls) ou CSV"
      });
      return;
    }

    setStep('preview');
    
    // Simular análise do arquivo
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Preview simulado baseado no arquivo
    setPreviewData({
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
      detectedTabs: ['DRE', 'CONSOLIDADO', 'CREDITO', 'FECHAMENTO EXCHANGE'],
      recordCount: 156,
      warnings: [],
      errors: []
    });
  };

  const handleStartImport = async () => {
    setStep('validating');
    setProgress(0);

    // Simular processo de importação
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setProgress(i);
    }

    setStep('complete');
    toast.success("Importação concluída!", {
      description: "Os dados foram validados e importados com sucesso."
    });

    if (onImportComplete) {
      onImportComplete({
        success: true,
        recordsImported: previewData?.recordCount || 0
      });
    }
  };

  const handleClose = () => {
    setStep('upload');
    setProgress(0);
    setPreviewData(null);
    onOpenChange(false);
  };

  const resetUpload = () => {
    setStep('upload');
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Planilha
          </DialogTitle>
          <DialogDescription>
            Importe sua planilha de fechamento consolidado. O sistema irá validar e mapear automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">Clique para selecionar ou arraste o arquivo</p>
              <p className="text-sm text-muted-foreground mt-1">
                Formatos aceitos: .xlsx, .xls, .csv
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Mapeamento de abas esperado:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(SPREADSHEET_TAB_MAPPING).map(([tab, config]) => (
                  <div key={tab} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span>{tab}</span>
                    <span className="text-muted-foreground">→ {config.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Regras de importação</p>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>• Duplicidades serão detectadas e bloqueadas automaticamente</li>
                    <li>• Um preview será exibido antes da importação final</li>
                    <li>• Dados serão categorizados conforme plano de contas</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && previewData && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
              <FileSpreadsheet className="h-10 w-10 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{previewData.fileName}</p>
                <p className="text-sm text-muted-foreground">{previewData.fileSize}</p>
              </div>
              <Badge variant="outline">{previewData.recordCount} registros</Badge>
            </div>

            <div>
              <h4 className="font-medium mb-2">Abas detectadas:</h4>
              <div className="flex flex-wrap gap-2">
                {previewData.detectedTabs.map(tab => (
                  <Badge key={tab} className="bg-success/10 text-success border-success/20">
                    <Check className="h-3 w-3 mr-1" />
                    {tab}
                  </Badge>
                ))}
              </div>
            </div>

            {previewData.warnings.length > 0 && (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileWarning className="h-5 w-5 text-warning" />
                  <span className="font-medium text-warning">Avisos ({previewData.warnings.length})</span>
                </div>
                <ul className="text-sm space-y-1">
                  {previewData.warnings.map((warning, i) => (
                    <li key={i} className="text-muted-foreground">• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {previewData.errors.length > 0 && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <X className="h-5 w-5 text-destructive" />
                  <span className="font-medium text-destructive">Erros ({previewData.errors.length})</span>
                </div>
                <ul className="text-sm space-y-1">
                  {previewData.errors.map((error, i) => (
                    <li key={i} className="text-muted-foreground">• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 'validating' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <p className="font-medium mb-2">Validando e importando dados...</p>
            <p className="text-sm text-muted-foreground mb-4">
              Verificando duplicidades e regras de negócio
            </p>
            <Progress value={progress} className="h-2 max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">{progress}%</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <p className="font-medium text-lg mb-2">Importação concluída!</p>
            <p className="text-sm text-muted-foreground">
              {previewData?.recordCount || 0} registros importados com sucesso
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetUpload}>Voltar</Button>
              <Button onClick={handleStartImport} disabled={previewData?.errors.length ? previewData.errors.length > 0 : false}>
                Confirmar Importação
              </Button>
            </>
          )}
          
          {step === 'complete' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
