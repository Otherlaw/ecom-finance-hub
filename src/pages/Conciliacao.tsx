import { useState } from "react";
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
  Building,
  CreditCard,
  ShoppingBag,
  Package,
  PenLine,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for different reconciliation types
const mockBancaria = [
  { id: 1, data: "01/11", descricao: "TED Recebido - Cliente ABC", valorExtrato: 15000, valorSistema: 15000, status: "ok", conta: "Itaú 1234" },
  { id: 2, data: "03/11", descricao: "Pagamento Boleto Fornecedor", valorExtrato: -8500, valorSistema: -8500, status: "ok", conta: "Itaú 1234" },
  { id: 3, data: "05/11", descricao: "PIX Recebido", valorExtrato: 3200, valorSistema: 0, status: "faltando", conta: "Nubank", diferenca: 3200 },
  { id: 4, data: "08/11", descricao: "Tarifa Bancária", valorExtrato: -45, valorSistema: -45, status: "ok", conta: "Itaú 1234" },
];

const mockCartoes = [
  { id: 1, data: "02/11", descricao: "Amazon AWS", valorFatura: 890, valorCategorizado: 890, status: "ok", cartao: "Nubank ****9999" },
  { id: 2, data: "05/11", descricao: "Google Ads", valorFatura: 2500, valorCategorizado: 2300, status: "divergencia", cartao: "Nubank ****9999", diferenca: 200 },
  { id: 3, data: "10/11", descricao: "Uber Freight", valorFatura: 450, valorCategorizado: 0, status: "pendente", cartao: "Itaú ****5678" },
];

const mockMarketplace = [
  { id: 1, data: "01/11", descricao: "Repasse ML - Lote #12345", valorRepasse: 45000, valorVendas: 45000, status: "ok", canal: "Mercado Livre" },
  { id: 2, data: "05/11", descricao: "Repasse Shopee - Lote #67890", valorRepasse: 12500, valorVendas: 12800, status: "divergencia", canal: "Shopee", diferenca: 300 },
  { id: 3, data: "08/11", descricao: "Repasse TikTok - Lote #11111", valorRepasse: 8900, valorVendas: 8900, status: "ok", canal: "TikTok Shop" },
  { id: 4, data: "12/11", descricao: "Repasse Shein - Lote #22222", valorRepasse: 0, valorVendas: 5600, status: "faltando", canal: "Shein", diferenca: 5600 },
];

const mockTiny = [
  { id: 1, data: "01/10", descricao: "Pagamento Fornecedor ABC", valorTiny: 45000, valorReal: 45000, status: "ok", categoria: "Fornecedores" },
  { id: 2, data: "05/10", descricao: "Repasse Mercado Livre", valorTiny: 125000, valorReal: 124850, status: "divergencia", categoria: "Vendas", diferenca: 150 },
  { id: 3, data: "08/10", descricao: "Taxa de Antecipação", valorTiny: 3200, valorReal: 3200, status: "ok", categoria: "Taxas" },
  { id: 4, data: "12/10", descricao: "Compra Estoque - Forn. XYZ", valorTiny: 0, valorReal: 28500, status: "faltando", categoria: "Estoque", diferenca: 28500 },
];

const mockManual = [
  { id: 1, data: "15/11", descricao: "Ajuste de Inventário", valor: -1200, tipo: "Despesa", status: "pendente", responsavel: "João Silva" },
  { id: 2, data: "18/11", descricao: "Reembolso Cliente", valor: 350, tipo: "Receita", status: "aprovado", responsavel: "Maria Santos" },
  { id: 3, data: "20/11", descricao: "Correção Lançamento Duplicado", valor: -2500, tipo: "Ajuste", status: "pendente", responsavel: "Admin" },
];

function calculateTotals(data: any[], statusField = "status") {
  return {
    registros: data.length,
    conciliados: data.filter(c => c[statusField] === "ok" || c[statusField] === "aprovado").length,
    divergencias: data.filter(c => c[statusField] === "divergencia").length,
    pendentes: data.filter(c => c[statusField] === "faltando" || c[statusField] === "pendente").length,
    totalDiferencas: data.reduce((acc, c) => acc + (c.diferenca || 0), 0),
  };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ok" || status === "aprovado") {
    return (
      <Badge className="bg-success/10 text-success border-success/20">
        <Check className="h-3 w-3 mr-1" />
        {status === "aprovado" ? "Aprovado" : "OK"}
      </Badge>
    );
  }
  if (status === "divergencia") {
    return (
      <Badge className="bg-warning/10 text-warning border-warning/20">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Divergência
      </Badge>
    );
  }
  if (status === "faltando" || status === "pendente") {
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20">
        <X className="h-3 w-3 mr-1" />
        {status === "pendente" ? "Pendente" : "Faltando"}
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function SummaryCards({ totals }: { totals: ReturnType<typeof calculateTotals> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-secondary">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Total</span>
        </div>
        <p className="text-2xl font-bold">{totals.registros}</p>
      </div>

      <div className="p-5 rounded-xl bg-success/5 border border-success/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-success/10">
            <Check className="h-4 w-4 text-success" />
          </div>
          <span className="text-sm text-muted-foreground">Conciliados</span>
        </div>
        <p className="text-2xl font-bold text-success">{totals.conciliados}</p>
        <p className="text-xs text-muted-foreground">
          {totals.registros > 0 ? ((totals.conciliados / totals.registros) * 100).toFixed(0) : 0}%
        </p>
      </div>

      <div className="p-5 rounded-xl bg-warning/5 border border-warning/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <span className="text-sm text-muted-foreground">Divergências</span>
        </div>
        <p className="text-2xl font-bold text-warning">{totals.divergencias}</p>
      </div>

      <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-destructive/10">
            <X className="h-4 w-4 text-destructive" />
          </div>
          <span className="text-sm text-muted-foreground">Pendentes</span>
        </div>
        <p className="text-2xl font-bold text-destructive">{totals.pendentes}</p>
        {totals.totalDiferencas > 0 && (
          <p className="text-xs text-muted-foreground">{formatCurrency(totals.totalDiferencas)}</p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ totals }: { totals: ReturnType<typeof calculateTotals> }) {
  const progress = totals.registros > 0 ? (totals.conciliados / totals.registros) * 100 : 0;
  return (
    <div className="mb-6 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Progresso da Conciliação</span>
        <span className="text-sm text-muted-foreground">
          {totals.conciliados} de {totals.registros} registros
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

function FilterBar() {
  return (
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
        Exportar
      </Button>
    </div>
  );
}

// Tab content components
function BancariaTab() {
  const totals = calculateTotals(mockBancaria);
  
  return (
    <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      <FilterBar />
      
      <ModuleCard title="Conciliação Bancária" description="Extrato vs Sistema" icon={Building} noPadding>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="w-[80px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Extrato</TableHead>
              <TableHead className="text-right">Sistema</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockBancaria.map((item) => (
              <TableRow key={item.id} className={item.status !== "ok" ? "bg-warning/5" : ""}>
                <TableCell className="font-medium">{item.data}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell><Badge variant="outline">{item.conta}</Badge></TableCell>
                <TableCell className={`text-right ${item.valorExtrato < 0 ? "text-destructive" : ""}`}>
                  {formatCurrency(item.valorExtrato)}
                </TableCell>
                <TableCell className={`text-right ${item.valorSistema < 0 ? "text-destructive" : ""}`}>
                  {item.valorSistema !== 0 ? formatCurrency(item.valorSistema) : "-"}
                </TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  {item.diferenca ? formatCurrency(item.diferenca) : "-"}
                </TableCell>
                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-center">
                  {item.status !== "ok" && <Button variant="ghost" size="sm">Resolver</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>
    </div>
  );
}

function CartoesTab() {
  const totals = calculateTotals(mockCartoes);
  
  return (
    <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      <FilterBar />
      
      <ModuleCard title="Conciliação de Cartões" description="Fatura vs Categorizado" icon={CreditCard} noPadding>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="w-[80px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Cartão</TableHead>
              <TableHead className="text-right">Fatura</TableHead>
              <TableHead className="text-right">Categorizado</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockCartoes.map((item) => (
              <TableRow key={item.id} className={item.status !== "ok" ? "bg-warning/5" : ""}>
                <TableCell className="font-medium">{item.data}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell><Badge variant="outline">{item.cartao}</Badge></TableCell>
                <TableCell className="text-right">{formatCurrency(item.valorFatura)}</TableCell>
                <TableCell className="text-right">
                  {item.valorCategorizado > 0 ? formatCurrency(item.valorCategorizado) : "-"}
                </TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  {item.diferenca ? formatCurrency(item.diferenca) : "-"}
                </TableCell>
                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-center">
                  {item.status !== "ok" && <Button variant="ghost" size="sm">Categorizar</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>
    </div>
  );
}

function MarketplaceTab() {
  const totals = calculateTotals(mockMarketplace);
  
  return (
    <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      <FilterBar />
      
      <ModuleCard title="Conciliação de Marketplace" description="Repasses vs Vendas" icon={ShoppingBag} noPadding>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="w-[80px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Repasse</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockMarketplace.map((item) => (
              <TableRow key={item.id} className={item.status !== "ok" ? "bg-warning/5" : ""}>
                <TableCell className="font-medium">{item.data}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    item.canal === "Mercado Livre" ? "border-yellow-500 text-yellow-600" :
                    item.canal === "Shopee" ? "border-orange-500 text-orange-600" :
                    item.canal === "TikTok Shop" ? "border-pink-500 text-pink-600" :
                    "border-purple-500 text-purple-600"
                  }>
                    {item.canal}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {item.valorRepasse > 0 ? formatCurrency(item.valorRepasse) : "-"}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(item.valorVendas)}</TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  {item.diferenca ? formatCurrency(item.diferenca) : "-"}
                </TableCell>
                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-center">
                  {item.status !== "ok" && <Button variant="ghost" size="sm">Resolver</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>
    </div>
  );
}

function TinyTab() {
  const totals = calculateTotals(mockTiny);
  
  return (
    <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      <FilterBar />
      
      <ModuleCard title="Conciliação Tiny" description="Tiny vs Sistema Real" icon={Package} noPadding>
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
            {mockTiny.map((item) => (
              <TableRow key={item.id} className={item.status !== "ok" ? "bg-warning/5" : ""}>
                <TableCell className="font-medium">{item.data}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell><Badge variant="outline">{item.categoria}</Badge></TableCell>
                <TableCell className="text-right">
                  {item.valorTiny > 0 ? formatCurrency(item.valorTiny) : "-"}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(item.valorReal)}</TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  {item.diferenca ? formatCurrency(item.diferenca) : "-"}
                </TableCell>
                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-center">
                  {item.status !== "ok" && <Button variant="ghost" size="sm">Resolver</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>
    </div>
  );
}

function ManualTab() {
  const totals = calculateTotals(mockManual);
  
  return (
    <div>
      <SummaryCards totals={totals} />
      <ProgressBar totals={totals} />
      
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição..." className="pl-10" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
        <Button className="gap-2">
          <PenLine className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>
      
      <ModuleCard title="Lançamentos Manuais" description="Ajustes e correções manuais" icon={PenLine} noPadding>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="w-[80px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockManual.map((item) => (
              <TableRow key={item.id} className={item.status === "pendente" ? "bg-warning/5" : ""}>
                <TableCell className="font-medium">{item.data}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    item.tipo === "Receita" ? "border-success text-success" :
                    item.tipo === "Despesa" ? "border-destructive text-destructive" :
                    ""
                  }>
                    {item.tipo}
                  </Badge>
                </TableCell>
                <TableCell>{item.responsavel}</TableCell>
                <TableCell className={`text-right font-medium ${item.valor < 0 ? "text-destructive" : "text-success"}`}>
                  {formatCurrency(item.valor)}
                </TableCell>
                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-center">
                  {item.status === "pendente" && (
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="sm" className="text-success">Aprovar</Button>
                      <Button variant="ghost" size="sm" className="text-destructive">Rejeitar</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>
    </div>
  );
}

export default function Conciliacao() {
  const [activeTab, setActiveTab] = useState("bancaria");

  return (
    <MainLayout
      title="Conciliações"
      subtitle="Central de conciliação bancária, cartões, marketplace, Tiny e manual"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reconciliar Tudo
          </Button>
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="bancaria" className="gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Bancária</span>
          </TabsTrigger>
          <TabsTrigger value="cartoes" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Cartões</span>
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Marketplace</span>
          </TabsTrigger>
          <TabsTrigger value="tiny" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Tiny</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">Manual</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bancaria">
          <BancariaTab />
        </TabsContent>

        <TabsContent value="cartoes">
          <CartoesTab />
        </TabsContent>

        <TabsContent value="marketplace">
          <MarketplaceTab />
        </TabsContent>

        <TabsContent value="tiny">
          <TinyTab />
        </TabsContent>

        <TabsContent value="manual">
          <ManualTab />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
