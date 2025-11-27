import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText, FileSpreadsheet, Check } from "lucide-react";
import { toast } from "sonner";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  modules?: string[];
}

export function ExportModal({ open, onOpenChange, title = "Exportar Dados", modules = ["DRE", "Balanço", "Fluxo de Caixa", "KPIs"] }: ExportModalProps) {
  const [format, setFormat] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [selectedModules, setSelectedModules] = useState<string[]>(modules);
  const [isExporting, setIsExporting] = useState(false);

  const toggleModule = (module: string) => {
    setSelectedModules(prev => 
      prev.includes(module) 
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

  const handleExport = async () => {
    if (selectedModules.length === 0) {
      toast.error("Selecione ao menos um módulo para exportar");
      return;
    }

    setIsExporting(true);
    
    // Simular exportação
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsExporting(false);
    
    toast.success("Exportação concluída!", {
      description: `Arquivo ${format.toUpperCase()} gerado com ${selectedModules.length} módulo(s)`
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Selecione o formato e os módulos que deseja exportar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Formato */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Formato do arquivo</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'pdf' | 'xlsx' | 'csv')} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-destructive" />
                  PDF
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-success" />
                  Excel
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-info" />
                  CSV
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Módulos */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Módulos para exportar</Label>
            <div className="grid grid-cols-2 gap-3">
              {modules.map(module => (
                <div 
                  key={module}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedModules.includes(module) 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleModule(module)}
                >
                  <Checkbox 
                    checked={selectedModules.includes(module)}
                    onCheckedChange={() => toggleModule(module)}
                  />
                  <span className="text-sm font-medium">{module}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <div className="p-4 rounded-lg bg-secondary/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Arquivo a ser gerado:</span>
              <Badge variant="outline">
                {selectedModules.length} módulo(s) • {format.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedModules.length === 0}>
            {isExporting ? (
              <>Exportando...</>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
