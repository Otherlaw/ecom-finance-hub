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
import { Checkbox } from "@/components/ui/checkbox";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos } from "@/hooks/useProdutos";
import { useProdutoSkuMap } from "@/hooks/useProdutoSkuMap";
import { toast } from "sonner";
import { exportarProdutos, exportarMapeamentosUpseller } from "@/lib/produtos-import-export";

interface ExportarProdutosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportarProdutosModal({
  open,
  onOpenChange,
}: ExportarProdutosModalProps) {
  const { empresas = [] } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("todas");
  const [formato, setFormato] = useState<'csv' | 'xlsx'>('xlsx');
  const [incluirMapeamentos, setIncluirMapeamentos] = useState(true);
  const [exportarApenasMapeamentos, setExportarApenasMapeamentos] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { produtos = [], isLoading } = useProdutos({
    empresaId: empresaId !== 'todas' ? empresaId : undefined,
  });

  const { mapeamentos = [] } = useProdutoSkuMap({
    empresaId: empresaId !== 'todas' ? empresaId : undefined,
  });

  const handleExportar = () => {
    if (exportarApenasMapeamentos) {
      // Exportar apenas mapeamentos no formato Upseller
      if (mapeamentos.length === 0) {
        toast.error("Nenhum mapeamento para exportar");
        return;
      }

      setIsExporting(true);

      try {
        const blob = exportarMapeamentosUpseller(mapeamentos, formato);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 12);
        a.download = `SKU_Map_Relationship_${timestamp}.${formato}`;
        
        a.click();
        URL.revokeObjectURL(url);
        
        toast.success(`${mapeamentos.length} mapeamentos exportados com sucesso`);
        onOpenChange(false);
      } catch (err) {
        console.error("Erro ao exportar:", err);
        toast.error("Erro ao exportar mapeamentos");
      } finally {
        setIsExporting(false);
      }
    } else {
      // Exportar produtos (com ou sem mapeamentos)
      if (produtos.length === 0) {
        toast.error("Nenhum produto para exportar");
        return;
      }

      setIsExporting(true);

      try {
        const blob = exportarProdutos(
          produtos, 
          formato,
          incluirMapeamentos ? mapeamentos : undefined
        );
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
    }
  };

  const totalItens = exportarApenasMapeamentos ? mapeamentos.length : produtos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Exportar Produtos (Formato Upseller)
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

          <div className="space-y-3 border-t pt-4">
            <Label>Opções de Exportação</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="incluirMapeamentos" 
                checked={incluirMapeamentos}
                onCheckedChange={(checked) => setIncluirMapeamentos(checked as boolean)}
                disabled={exportarApenasMapeamentos}
              />
              <Label htmlFor="incluirMapeamentos" className="font-normal cursor-pointer">
                Incluir mapeamentos de marketplace (anúncios, variantes)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="apenasMapeamentos" 
                checked={exportarApenasMapeamentos}
                onCheckedChange={(checked) => setExportarApenasMapeamentos(checked as boolean)}
              />
              <Label htmlFor="apenasMapeamentos" className="font-normal cursor-pointer">
                Exportar apenas mapeamentos (formato SKU_Map_Relationship)
              </Label>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold">{totalItens}</div>
            <div className="text-sm text-muted-foreground">
              {exportarApenasMapeamentos ? 'mapeamentos' : 'produtos'} serão exportados
            </div>
            {incluirMapeamentos && !exportarApenasMapeamentos && mapeamentos.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                ({mapeamentos.length} mapeamentos incluídos)
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleExportar} 
            disabled={isExporting || isLoading || totalItens === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exportando..." : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
