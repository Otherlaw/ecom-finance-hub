import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos } from "@/hooks/useProdutos";
import { toast } from "sonner";
import { exportarProdutos } from "@/lib/produtos-import-export";

interface ExportarProdutosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportarProdutosModal({
  open,
  onOpenChange,
}: ExportarProdutosModalProps) {
  const { empresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("todas");
  const [formato, setFormato] = useState<'csv' | 'xlsx'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const { produtos, isLoading } = useProdutos({
    empresaId: empresaId !== 'todas' ? empresaId : undefined,
  });

  const handleExportar = () => {
    if (produtos.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }

    setIsExporting(true);

    try {
      const blob = exportarProdutos(produtos, formato);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `produtos_${timestamp}.${formato}`;
      
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`${produtos.length} produtos exportados com sucesso`);
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao exportar:", err);
      toast.error("Erro ao exportar produtos");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Exportar Produtos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Formato</Label>
            <RadioGroup value={formato} onValueChange={(v) => setFormato(v as 'csv' | 'xlsx')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="font-normal cursor-pointer">
                  Excel (.xlsx)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal cursor-pointer">
                  CSV (.csv)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold">{produtos.length}</div>
            <div className="text-sm text-muted-foreground">
              produtos serão exportados
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleExportar} 
            disabled={isExporting || isLoading || produtos.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exportando..." : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
