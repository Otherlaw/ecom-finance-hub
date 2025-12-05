/**
 * Modal de importação de produtos em massa via CSV/XLSX
 * Baseado na estrutura exportada do Upseller
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos, ProdutoInsert } from "@/hooks/useProdutos";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportProdutosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ProdutoPreview {
  sku_interno: string;
  sku_marketplace?: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  preco_custo: number;
  preco_venda: number;
  unidade: string;
  ativo: boolean;
  existeNoBanco: boolean;
  valido: boolean;
  erros: string[];
}

interface ImportResult {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
}

// Mapeamento flexível de colunas (baseado na estrutura do Upseller)
const COLUMN_MAPPINGS: Record<string, string[]> = {
  sku_interno: ["sku_interno", "sku", "codigo", "codigo_interno", "cod", "id_produto", "product_id"],
  sku_marketplace: ["sku_marketplace", "mlb", "anuncio_id", "id_anuncio", "marketplace_sku"],
  nome: ["nome", "titulo", "name", "title", "produto", "descricao_produto"],
  descricao: ["descricao", "description", "obs", "observacao"],
  categoria: ["categoria", "category", "tipo"],
  preco_custo: ["preco_custo", "custo", "cost", "custo_unitario", "valor_custo"],
  preco_venda: ["preco_venda", "preco", "price", "valor_venda", "valor"],
  unidade: ["unidade", "un", "unit", "medida", "unidade_medida"],
  ativo: ["ativo", "status", "active", "situacao"],
};

function findColumnValue(row: Record<string, any>, possibleNames: string[]): any {
  const keys = Object.keys(row);
  for (const name of possibleNames) {
    const found = keys.find(k => k.toLowerCase().trim() === name.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== "") {
      return row[found];
    }
  }
  return undefined;
}

function parseNumber(val: any): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function parseBoolean(val: any): boolean {
  if (typeof val === "boolean") return val;
  if (!val) return true;
  const str = String(val).toLowerCase().trim();
  return str === "sim" || str === "s" || str === "yes" || str === "y" || str === "1" || str === "ativo" || str === "true";
}

export function ImportProdutosModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportProdutosModalProps) {
  const { empresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("");
  const { produtos, criarProduto, atualizarProduto } = useProdutos({ empresaId });
  
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "result">("upload");
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProdutoPreview[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const resetForm = useCallback(() => {
    setStep("upload");
    setFileName("");
    setError(null);
    setPreview([]);
    setProgress(0);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const downloadModelo = useCallback(() => {
    const headers = [
      "sku_interno",
      "sku_marketplace",
      "nome",
      "descricao",
      "categoria",
      "preco_custo",
      "preco_venda",
      "unidade",
      "ativo",
    ];
    
    const exemploData = [
      {
        sku_interno: "SKU-001",
        sku_marketplace: "MLB123456789",
        nome: "Produto Exemplo 1",
        descricao: "Descrição do produto",
        categoria: "Eletrônicos",
        preco_custo: 50.00,
        preco_venda: 99.90,
        unidade: "un",
        ativo: "sim",
      },
      {
        sku_interno: "SKU-002",
        sku_marketplace: "",
        nome: "Produto Exemplo 2",
        descricao: "",
        categoria: "Informática",
        preco_custo: 120.00,
        preco_venda: 199.90,
        unidade: "un",
        ativo: "sim",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(exemploData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "modelo_importacao_produtos.xlsx");
    toast.success("Planilha modelo baixada!");
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: Record<string, any>[] = [];

      if (ext === "csv") {
        const text = await file.text();
        const lines = text.split("\n").filter(l => l.trim());
        if (lines.length < 2) {
          setError("Arquivo vazio ou sem dados");
          return;
        }
        const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/"/g, ""));
        rows = lines.slice(1).map(line => {
          const values = line.split(/[,;]/).map(v => v.trim().replace(/"/g, ""));
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            obj[h] = values[i] || "";
          });
          return obj;
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else {
        setError("Formato não suportado. Use CSV ou XLSX.");
        return;
      }

      if (rows.length === 0) {
        setError("Nenhum dado encontrado no arquivo");
        return;
      }

      // Mapear para preview
      const previews: ProdutoPreview[] = [];
      const skusExistentes = new Set(produtos.map(p => p.codigo_interno.toLowerCase()));

      for (const row of rows) {
        const skuInterno = String(findColumnValue(row, COLUMN_MAPPINGS.sku_interno) || "").trim();
        const nome = String(findColumnValue(row, COLUMN_MAPPINGS.nome) || "").trim();
        
        if (!skuInterno) continue; // Ignorar linhas sem SKU

        const precoCusto = parseNumber(findColumnValue(row, COLUMN_MAPPINGS.preco_custo));
        const precoVenda = parseNumber(findColumnValue(row, COLUMN_MAPPINGS.preco_venda));
        const unidade = String(findColumnValue(row, COLUMN_MAPPINGS.unidade) || "un").trim() || "un";
        const ativo = parseBoolean(findColumnValue(row, COLUMN_MAPPINGS.ativo));

        const erros: string[] = [];
        if (!nome) erros.push("Nome obrigatório");
        if (precoCusto < 0) erros.push("Preço custo inválido");
        if (precoVenda < 0) erros.push("Preço venda inválido");

        previews.push({
          sku_interno: skuInterno,
          sku_marketplace: String(findColumnValue(row, COLUMN_MAPPINGS.sku_marketplace) || "").trim(),
          nome,
          descricao: String(findColumnValue(row, COLUMN_MAPPINGS.descricao) || "").trim(),
          categoria: String(findColumnValue(row, COLUMN_MAPPINGS.categoria) || "").trim(),
          preco_custo: precoCusto,
          preco_venda: precoVenda,
          unidade,
          ativo,
          existeNoBanco: skusExistentes.has(skuInterno.toLowerCase()),
          valido: erros.length === 0,
          erros,
        });
      }

      if (previews.length === 0) {
        setError("Nenhum produto válido encontrado no arquivo. Verifique se a coluna 'sku_interno' está preenchida.");
        return;
      }

      setPreview(previews);
      setStep("preview");
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      setError("Erro ao processar o arquivo. Verifique o formato.");
    }
  }, [produtos]);

  const handleImport = useCallback(async () => {
    if (!empresaId || preview.length === 0) return;

    setStep("importing");
    setProgress(0);

    const validProducts = preview.filter(p => p.valido);
    const resultData: ImportResult = { criados: 0, atualizados: 0, ignorados: 0, erros: [] };

    for (let i = 0; i < validProducts.length; i++) {
      const p = validProducts[i];
      setProgress(Math.round(((i + 1) / validProducts.length) * 100));

      try {
        // Verificar se já existe no banco
        const existente = produtos.find(prod => prod.codigo_interno.toLowerCase() === p.sku_interno.toLowerCase());

        if (existente) {
          // Atualizar
          await atualizarProduto.mutateAsync({
            id: existente.id,
            nome: p.nome,
            descricao: p.descricao || undefined,
            categoria: p.categoria || undefined,
            custo_medio_atual: p.preco_custo,
            preco_venda_sugerido: p.preco_venda,
            unidade_medida: p.unidade,
            status: p.ativo ? "ativo" : "inativo",
          });
          resultData.atualizados++;
        } else {
          // Criar novo
          const insertData: ProdutoInsert = {
            empresa_id: empresaId,
            codigo_interno: p.sku_interno,
            nome: p.nome,
            descricao: p.descricao || undefined,
            categoria: p.categoria || undefined,
            custo_medio_atual: p.preco_custo,
            preco_venda_sugerido: p.preco_venda,
            unidade_medida: p.unidade,
            status: p.ativo ? "ativo" : "inativo",
          };
          await criarProduto.mutateAsync(insertData);
          resultData.criados++;
        }
      } catch (err: any) {
        resultData.erros.push(`${p.sku_interno}: ${err.message || "Erro desconhecido"}`);
        resultData.ignorados++;
      }
    }

    resultData.ignorados += preview.filter(p => !p.valido).length;
    setResult(resultData);
    setStep("result");
    onSuccess?.();
  }, [empresaId, preview, produtos, criarProduto, atualizarProduto, onSuccess]);

  const stats = {
    total: preview.length,
    novos: preview.filter(p => p.valido && !p.existeNoBanco).length,
    atualizacoes: preview.filter(p => p.valido && p.existeNoBanco).length,
    invalidos: preview.filter(p => !p.valido).length,
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Produtos</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Arquivo CSV ou XLSX</Label>
                  <Button variant="link" size="sm" onClick={downloadModelo}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar planilha modelo
                  </Button>
                </div>
                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload-produtos"
                    disabled={!empresaId}
                  />
                  <label
                    htmlFor="file-upload-produtos"
                    className={`cursor-pointer flex flex-col items-center gap-2 ${!empresaId ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                    {fileName ? (
                      <span className="font-medium">{fileName}</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Clique para selecionar ou arraste o arquivo</span>
                        <span className="text-xs text-muted-foreground">Suporta CSV e XLSX</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="p-3 bg-success/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-success">{stats.novos}</div>
                  <div className="text-xs text-muted-foreground">Novos</div>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{stats.atualizacoes}</div>
                  <div className="text-xs text-muted-foreground">Atualizações</div>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-destructive">{stats.invalidos}</div>
                  <div className="text-xs text-muted-foreground">Inválidos</div>
                </div>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Venda</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 100).map((p, i) => (
                      <TableRow key={i} className={!p.valido ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-sm">{p.sku_interno}</TableCell>
                        <TableCell className="max-w-48 truncate">{p.nome || <span className="text-destructive">Sem nome</span>}</TableCell>
                        <TableCell>{p.categoria || "-"}</TableCell>
                        <TableCell className="text-right">R$ {p.preco_custo.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {p.preco_venda.toFixed(2)}</TableCell>
                        <TableCell>
                          {!p.valido ? (
                            <Badge variant="destructive">Inválido</Badge>
                          ) : p.existeNoBanco ? (
                            <Badge variant="outline">Atualizar</Badge>
                          ) : (
                            <Badge variant="default">Novo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {preview.length > 100 && (
                <p className="text-sm text-muted-foreground text-center">
                  Mostrando 100 de {preview.length} produtos
                </p>
              )}
            </div>
          )}

          {step === "importing" && (
            <div className="py-12 space-y-6 text-center">
              <div className="text-lg font-medium">Importando produtos...</div>
              <Progress value={progress} className="w-full max-w-md mx-auto" />
              <div className="text-sm text-muted-foreground">{progress}% concluído</div>
            </div>
          )}

          {step === "result" && result && (
            <div className="py-8 space-y-6">
              <div className="flex items-center justify-center gap-2 text-success">
                <CheckCircle2 className="h-8 w-8" />
                <span className="text-xl font-medium">Importação concluída!</span>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="p-4 bg-success/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-success">{result.criados}</div>
                  <div className="text-sm text-muted-foreground">Criados</div>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{result.atualizados}</div>
                  <div className="text-sm text-muted-foreground">Atualizados</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{result.ignorados}</div>
                  <div className="text-sm text-muted-foreground">Ignorados</div>
                </div>
              </div>

              {result.erros.length > 0 && (
                <Alert variant="destructive" className="max-w-lg mx-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">Erros encontrados:</div>
                    <ul className="text-xs space-y-1">
                      {result.erros.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {result.erros.length > 5 && (
                        <li>... e mais {result.erros.length - 5} erros</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => { resetForm(); }}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={stats.novos + stats.atualizacoes === 0}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {stats.novos + stats.atualizacoes} produtos
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
