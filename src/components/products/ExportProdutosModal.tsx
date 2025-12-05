/**
 * Modal de exportação de produtos para CSV/XLSX
 */

import { useState, useCallback } from "react";
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
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos } from "@/hooks/useProdutos";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ExportProdutosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportProdutosModal({
  open,
  onOpenChange,
}: ExportProdutosModalProps) {
  const { empresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("todas");
  const [includeInativos, setIncludeInativos] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { produtos, isLoading } = useProdutos({
    empresaId: empresaId === "todas" ? undefined : empresaId,
    status: includeInativos ? "todos" : "ativo",
  });

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const exportToFormat = useCallback(async (format: "csv" | "xlsx") => {
    if (produtos.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }

    setIsExporting(true);

    try {
      // Preparar dados para exportação
      const data = produtos.map(p => ({
        sku_interno: p.codigo_interno,
        sku_marketplace: (p.canais as any[])?.find((c: any) => c.channel === "mercado_livre")?.sku || "",
        nome: p.nome,
        descricao: p.descricao || "",
        categoria: p.categoria || "",
        preco_custo: p.custo_medio_atual,
        preco_venda: p.preco_venda_sugerido || 0,
        unidade: p.unidade_medida,
        ativo: p.status === "ativo" ? "sim" : "não",
        ncm: p.ncm || "",
        estoque_atual: p.estoque_atual || 0,
      }));

      const empresaNome = empresaId === "todas" 
        ? "todas" 
        : empresas.find(e => e.id === empresaId)?.nome_fantasia || "empresa";
      
      const timestamp = new Date().toISOString().split("T")[0];
      const fileName = `produtos_${empresaNome.toLowerCase().replace(/\s/g, "_")}_${timestamp}`;

      if (format === "xlsx") {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produtos");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else {
        // CSV
        const headers = Object.keys(data[0]).join(";");
        const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(";"));
        const csv = [headers, ...rows].join("\n");
        
        const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`${produtos.length} produtos exportados com sucesso!`);
      handleClose();
    } catch (err) {
      console.error("Erro ao exportar:", err);
      toast.error("Erro ao exportar produtos");
    } finally {
      setIsExporting(false);
    }
  }, [produtos, empresaId, empresas, handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Produtos</DialogTitle>
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeInativos"
              checked={includeInativos}
              onCheckedChange={(checked) => setIncludeInativos(checked as boolean)}
            />
            <Label htmlFor="includeInativos" className="cursor-pointer">
              Incluir produtos inativos
            </Label>
          </div>

          <div className="p-4 bg-secondary/50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Produtos a exportar</div>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : produtos.length}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => exportToFormat("csv")}
            disabled={isExporting || isLoading || produtos.length === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            onClick={() => exportToFormat("xlsx")}
            disabled={isExporting || isLoading || produtos.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar XLSX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
