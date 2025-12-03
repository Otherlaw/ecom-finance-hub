import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/mock-data";
import {
  RefreshCw,
  Upload,
  Download,
  Check,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Search,
  Filter,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

const conciliacaoData = [
  { 
    id: 1, 
    data: "01/10", 
    descricao: "Pagamento Fornecedor ABC", 
    valorTiny: 45000, 
    valorReal: 45000, 
    status: "ok",
    categoria: "Fornecedores" 
  },
  { 
    id: 2, 
    data: "05/10", 
    descricao: "Repasse Mercado Livre", 
    valorTiny: 125000, 
    valorReal: 124850, 
    status: "divergencia",
    categoria: "Vendas",
    diferenca: 150
  },
  { 
    id: 3, 
    data: "08/10", 
    descricao: "Taxa de Antecipação", 
    valorTiny: 3200, 
    valorReal: 3200, 
    status: "ok",
    categoria: "Taxas" 
  },
  { 
    id: 4, 
    data: "10/10", 
    descricao: "Folha de Pagamento", 
    valorTiny: 35000, 
    valorReal: 35000, 
    status: "ok",
    categoria: "Pessoal" 
  },
  { 
    id: 5, 
    data: "12/10", 
    descricao: "Compra Estoque - Forn. XYZ", 
    valorTiny: 0, 
    valorReal: 28500, 
    status: "faltando",
    categoria: "Estoque",
    diferenca: 28500
  },
  { 
    id: 6, 
    data: "15/10", 
    descricao: "Repasse Shopee", 
    valorTiny: 38000, 
    valorReal: 38000, 
    status: "ok",
    categoria: "Vendas" 
  },
  { 
    id: 7, 
    data: "18/10", 
    descricao: "Marketing Digital", 
    valorTiny: 25000, 
    valorReal: 27500, 
    status: "divergencia",
    categoria: "Marketing",
    diferenca: 2500
  },
  { 
    id: 8, 
    data: "22/10", 
    descricao: "Frete Transportadora", 
    valorTiny: 42000, 
    valorReal: 42000, 
    status: "ok",
    categoria: "Logística" 
  },
];

const totais = {
  registros: conciliacaoData.length,
  conciliados: conciliacaoData.filter(c => c.status === "ok").length,
  divergencias: conciliacaoData.filter(c => c.status === "divergencia").length,
  faltando: conciliacaoData.filter(c => c.status === "faltando").length,
  totalDiferencas: conciliacaoData.reduce((acc, c) => acc + (c.diferenca || 0), 0),
};

export default function Conciliacao() {
  return (
    <MainLayout
      title="Conciliações"
      subtitle="Central de conciliação bancária, cartões, marketplace e Tiny"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV/XLS
          </Button>
          <Button className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reconciliar
          </Button>
        </div>
      }
    >
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-secondary">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Total Registros</span>
          </div>
          <p className="text-3xl font-bold">{totais.registros}</p>
        </div>

        <div className="p-6 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Check className="h-5 w-5 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">Conciliados</span>
          </div>
          <p className="text-3xl font-bold text-success">{totais.conciliados}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {((totais.conciliados / totais.registros) * 100).toFixed(0)}% do total
          </p>
        </div>

        <div className="p-6 rounded-xl bg-warning/5 border border-warning/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <span className="text-sm text-muted-foreground">Divergências</span>
          </div>
          <p className="text-3xl font-bold text-warning">{totais.divergencias}</p>
          <p className="text-sm text-muted-foreground mt-1">Requer análise</p>
        </div>

        <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <X className="h-5 w-5 text-destructive" />
            </div>
            <span className="text-sm text-muted-foreground">Faltando no Tiny</span>
          </div>
          <p className="text-3xl font-bold text-destructive">{totais.faltando}</p>
          <p className="text-sm text-muted-foreground mt-1">{formatCurrency(totais.totalDiferencas)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progresso da Conciliação</span>
          <span className="text-sm text-muted-foreground">
            {totais.conciliados} de {totais.registros} registros
          </span>
        </div>
        <Progress value={(totais.conciliados / totais.registros) * 100} className="h-2" />
      </div>

      {/* Filtros e Busca */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição..." className="pl-10" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Divergências
        </Button>
      </div>

      {/* Tabela de Conciliação */}
      <ModuleCard
        title="Registros"
        description="Comparativo Tiny vs Real"
        icon={RefreshCw}
        noPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="w-[80px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor Tiny</TableHead>
              <TableHead className="text-right">Valor Real</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conciliacaoData.map((item) => (
              <TableRow key={item.id} className={item.status !== "ok" ? "bg-warning/5" : ""}>
                <TableCell className="font-medium">{item.data}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.categoria}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {item.valorTiny > 0 ? formatCurrency(item.valorTiny) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.valorReal)}
                </TableCell>
                <TableCell className={`text-right font-medium ${item.diferenca ? "text-destructive" : ""}`}>
                  {item.diferenca ? formatCurrency(item.diferenca) : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {item.status === "ok" && (
                    <Badge className="bg-success/10 text-success border-success/20">
                      <Check className="h-3 w-3 mr-1" />
                      OK
                    </Badge>
                  )}
                  {item.status === "divergencia" && (
                    <Badge className="bg-warning/10 text-warning border-warning/20">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Divergência
                    </Badge>
                  )}
                  {item.status === "faltando" && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                      <X className="h-3 w-3 mr-1" />
                      Faltando
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {item.status !== "ok" && (
                    <Button variant="ghost" size="sm">
                      Resolver
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>

      {/* Resumo de Diferenças */}
      {totais.totalDiferencas > 0 && (
        <div className="mt-6">
          <ModuleCard
            title="Resumo das Diferenças"
            description="Valores a serem ajustados"
            icon={AlertTriangle}
          >
            <div className="flex items-center justify-between p-4 rounded-lg bg-warning/5 border border-warning/20">
              <div>
                <p className="font-semibold">Total de diferenças encontradas</p>
                <p className="text-sm text-muted-foreground">
                  {totais.divergencias + totais.faltando} registros com problemas
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-warning">{formatCurrency(totais.totalDiferencas)}</p>
                <Button variant="outline" size="sm" className="mt-2 border-warning text-warning hover:bg-warning/10">
                  Gerar Relatório
                </Button>
              </div>
            </div>
          </ModuleCard>
        </div>
      )}
    </MainLayout>
  );
}
