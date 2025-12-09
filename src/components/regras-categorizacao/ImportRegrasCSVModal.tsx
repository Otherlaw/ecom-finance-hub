import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface ImportRegrasCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PreviewRow {
  linha: number;
  estabelecimento_pattern: string;
  categoria_nome: string;
  centro_custo_nome: string;
  responsavel_nome: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  valido: boolean;
  erros: string[];
}

export function ImportRegrasCSVModal({ open, onOpenChange }: ImportRegrasCSVModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<{ sucesso: number; erros: number } | null>(null);

  const { data: categorias } = useQuery({
    queryKey: ["categorias_financeiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: centrosCusto } = useQuery({
    queryKey: ["centros_de_custo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_de_custo")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: responsaveis } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error("O arquivo deve conter cabeçalho e pelo menos uma linha de dados");
        return;
      }

      const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());
      const preview: PreviewRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(";").map((v) => v.trim());
        const dados: Record<string, string> = {};
        headers.forEach((header, index) => {
          dados[header] = values[index] || "";
        });

        const estabelecimento = dados["estabelecimento_pattern"] || dados["estabelecimento"] || dados["padrao"] || "";
        const categoriaNome = dados["categoria"] || dados["categoria_financeira"] || "";
        const centroCustoNome = dados["centro_custo"] || dados["centro_de_custo"] || "";
        const responsavelNome = dados["responsavel"] || "";

        const erros: string[] = [];

        if (!estabelecimento) {
          erros.push("Padrão do estabelecimento é obrigatório");
        }

        // Match categoria by name
        const categoriaMatch = categorias?.find(
          (c) => c.nome.toLowerCase() === categoriaNome.toLowerCase()
        );

        // Match centro de custo by name
        const centroCustoMatch = centrosCusto?.find(
          (c) => c.nome.toLowerCase() === centroCustoNome.toLowerCase()
        );

        // Match responsavel by name
        const responsavelMatch = responsaveis?.find(
          (r) => r.nome.toLowerCase() === responsavelNome.toLowerCase()
        );

        if (categoriaNome && !categoriaMatch) {
          erros.push(`Categoria "${categoriaNome}" não encontrada`);
        }

        if (centroCustoNome && !centroCustoMatch) {
          erros.push(`Centro de custo "${centroCustoNome}" não encontrado`);
        }

        if (responsavelNome && !responsavelMatch) {
          erros.push(`Responsável "${responsavelNome}" não encontrado`);
        }

        preview.push({
          linha: i + 1,
          estabelecimento_pattern: estabelecimento,
          categoria_nome: categoriaNome,
          centro_custo_nome: centroCustoNome,
          responsavel_nome: responsavelNome,
          categoria_id: categoriaMatch?.id || null,
          centro_custo_id: centroCustoMatch?.id || null,
          responsavel_id: responsavelMatch?.id || null,
          valido: erros.length === 0,
          erros,
        });
      }

      setPreviewData(preview);
      setStep("preview");
    };

    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validas = previewData.filter((r) => r.valido);
      let sucesso = 0;
      let erros = 0;

      const DEFAULT_EMPRESA_ID = "d0b0c897-d560-4dc5-aa07-df99d3019bf5";

      for (const row of validas) {
        try {
          const { error } = await supabase.from("regras_categorizacao").insert({
            estabelecimento_pattern: row.estabelecimento_pattern.toLowerCase(),
            categoria_id: row.categoria_id,
            centro_custo_id: row.centro_custo_id,
            responsavel_id: row.responsavel_id,
            empresa_id: DEFAULT_EMPRESA_ID,
          });

          if (error) {
            erros++;
          } else {
            sucesso++;
          }
        } catch {
          erros++;
        }
      }

      return { sucesso, erros };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["regras-categorizacao-full"] });
      queryClient.invalidateQueries({ queryKey: ["regras-categorizacao"] });
      setImportResult(result);
      setStep("result");
    },
    onError: (error: any) => {
      toast.error("Erro na importação: " + error.message);
    },
  });

  const handleImport = () => {
    importMutation.mutate();
  };

  const handleDownloadTemplate = () => {
    const template = `estabelecimento_pattern;categoria;centro_custo;responsavel
uber;Transporte e Deslocamento;E-commerce;
ifood;Alimentação e Refeições;E-commerce;
amazon;Material de Escritório;E-commerce;
99;Transporte e Deslocamento;E-commerce;`;

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-regras-categorizacao.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setStep("upload");
    setPreviewData([]);
    setImportResult(null);
    onOpenChange(false);
  };

  const validCount = previewData.filter((r) => r.valido).length;
  const invalidCount = previewData.filter((r) => !r.valido).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Regras de Categorização</DialogTitle>
          <DialogDescription>
            Importe regras de categorização em lote via arquivo CSV
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste um arquivo CSV ou clique para selecionar
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivo
                  </span>
                </Button>
              </label>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Formato esperado do CSV:</h4>
              <p className="text-sm text-muted-foreground mb-3">
                O arquivo deve conter as colunas separadas por ponto e vírgula (;):
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>estabelecimento_pattern</strong> - Padrão para identificar o estabelecimento (obrigatório)</li>
                <li><strong>categoria</strong> - Nome exato da categoria financeira</li>
                <li><strong>centro_custo</strong> - Nome exato do centro de custo</li>
                <li><strong>responsavel</strong> - Nome exato do responsável</li>
              </ul>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {validCount} válidas
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {invalidCount} com erros
                </Badge>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Linha</TableHead>
                    <TableHead>Estabelecimento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row) => (
                    <TableRow key={row.linha} className={!row.valido ? "bg-destructive/5" : ""}>
                      <TableCell>{row.linha}</TableCell>
                      <TableCell>{row.estabelecimento_pattern || "—"}</TableCell>
                      <TableCell>
                        {row.categoria_nome || "—"}
                        {row.categoria_nome && !row.categoria_id && (
                          <span className="text-destructive text-xs block">Não encontrada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.centro_custo_nome || "—"}
                        {row.centro_custo_nome && !row.centro_custo_id && (
                          <span className="text-destructive text-xs block">Não encontrado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.responsavel_nome || "—"}
                        {row.responsavel_nome && !row.responsavel_id && (
                          <span className="text-destructive text-xs block">Não encontrado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.valido ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Erro</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0 || importMutation.isPending}>
                {importMutation.isPending ? "Importando..." : `Importar ${validCount} Regras`}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && importResult && (
          <div className="space-y-6 text-center py-8">
            <CheckCircle className="h-16 w-16 mx-auto text-emerald-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Importação Concluída</h3>
              <p className="text-muted-foreground">
                {importResult.sucesso} regras importadas com sucesso
                {importResult.erros > 0 && `, ${importResult.erros} com erro`}
              </p>
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
