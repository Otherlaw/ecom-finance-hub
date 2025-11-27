import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { icmsData } from "@/lib/mock-data";
import { mockCreditosICMS, calculateRecommendation, formatCurrency, formatDate, CreditoICMS } from "@/lib/icms-data";
import { XMLImportModal } from "@/components/icms/XMLImportModal";
import { ICMSCalculatorModal } from "@/components/icms/ICMSCalculatorModal";
import { ICMSRecommendationModal } from "@/components/icms/ICMSRecommendationModal";
import { Receipt, Download, AlertTriangle, TrendingUp, TrendingDown, Calculator, FileText, Upload, Plus, Lightbulb, Trash2, Edit2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function ICMS() {
  const [xmlImportOpen, setXmlImportOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditos, setCreditos] = useState<CreditoICMS[]>(mockCreditosICMS);
  const [editingCredit, setEditingCredit] = useState<CreditoICMS | null>(null);
  const [deletingCreditId, setDeletingCreditId] = useState<string | null>(null);

  const totalCreditos = useMemo(() => creditos.reduce((sum, c) => sum + c.valorCredito, 0), [creditos]);
  const existingKeys = useMemo(() => creditos.filter((c) => c.chaveAcesso).map((c) => c.chaveAcesso!), [creditos]);
  const recommendation = useMemo(() => calculateRecommendation(icmsData.icmsDevido, totalCreditos, 8), [totalCreditos]);
  const saldoProjetado = totalCreditos - icmsData.icmsDevido;
  const saldoNegativo = saldoProjetado < 0;
  const notasNecessarias = saldoNegativo ? Math.abs(saldoProjetado) / 0.08 : 0;

  const handleImportSuccess = (newCredits: CreditoICMS[]) => setCreditos((prev) => [...prev, ...newCredits]);
  const handleSaveCredit = (credit: CreditoICMS) => { if (editingCredit) { setCreditos((prev) => prev.map((c) => (c.id === credit.id ? credit : c))); } else { setCreditos((prev) => [...prev, credit]); } setEditingCredit(null); };
  const handleEditCredit = (credit: CreditoICMS) => { setEditingCredit(credit); setCalculatorOpen(true); };
  const handleDeleteClick = (id: string) => { setDeletingCreditId(id); setDeleteDialogOpen(true); };
  const handleConfirmDelete = () => { if (deletingCreditId) { setCreditos((prev) => prev.filter((c) => c.id !== deletingCreditId)); toast.success("Crédito excluído com sucesso."); } setDeleteDialogOpen(false); setDeletingCreditId(null); };
  const handleNewCredit = () => { setEditingCredit(null); setCalculatorOpen(true); };

  return (
    <MainLayout title="Controle de Crédito de ICMS" subtitle="Gestão de créditos e débitos fiscais" actions={<div className="flex items-center gap-2"><Button variant="outline" className="gap-2" onClick={() => setXmlImportOpen(true)}><Upload className="h-4 w-4" />Importar XML de NF-e</Button><Button className="gap-2" onClick={handleNewCredit}><Calculator className="h-4 w-4" />Novo Crédito</Button></div>}>
      {saldoNegativo && (<div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-4"><div className="p-2 rounded-lg bg-warning/20"><AlertTriangle className="h-6 w-6 text-warning" /></div><div className="flex-1"><h3 className="font-semibold text-warning">Atenção: Saldo de ICMS Negativo</h3><p className="text-sm text-muted-foreground mt-1">Você precisa adquirir notas fiscais com crédito de ICMS para compensar o saldo negativo. Recomendação: comprar {formatCurrency(notasNecessarias)} em mercadorias para zerar o ICMS.</p></div><Button variant="outline" className="border-warning text-warning hover:bg-warning/10" onClick={() => setRecommendationOpen(true)}><Lightbulb className="h-4 w-4 mr-2" />Ver Recomendação</Button></div>)}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard title="Crédito Disponível" value={formatCurrency(totalCreditos)} icon={TrendingUp} iconColor="text-success" trend="up" />
        <KPICard title="ICMS Devido" value={formatCurrency(icmsData.icmsDevido)} icon={TrendingDown} iconColor="text-destructive" trend="down" />
        <KPICard title="Saldo Projetado" value={formatCurrency(saldoProjetado)} icon={Receipt} trend={saldoProjetado >= 0 ? "up" : "down"} />
        <KPICard title="Compras Necessárias" value={formatCurrency(notasNecessarias)} changeLabel="Para zerar ICMS" icon={Calculator} trend="neutral" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ModuleCard title="Evolução do Saldo de ICMS" description="Últimos 6 meses" icon={Receipt} className="lg:col-span-2">
          <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={icmsData.historico}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} /><Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(value: number) => formatCurrency(value)} /><ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" /><Bar dataKey="credito" name="Crédito" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} /><Bar dataKey="debito" name="Débito" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </ModuleCard>
        <ModuleCard title="Resumo do Período" description="Outubro/2024">
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-secondary/50"><p className="text-sm text-muted-foreground mb-2">Saldo Atual</p><p className={`text-2xl font-bold ${saldoNegativo ? "text-destructive" : "text-success"}`}>{formatCurrency(saldoProjetado)}</p></div>
            <div><p className="text-sm font-medium mb-2">Detalhamento:</p><div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Total de créditos</span><span className="font-medium text-success">+{formatCurrency(totalCreditos)}</span></div><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">ICMS devido</span><span className="font-medium text-destructive">-{formatCurrency(icmsData.icmsDevido)}</span></div><div className="flex items-center justify-between text-sm border-t pt-2"><span className="text-muted-foreground">Notas cadastradas</span><span className="font-medium">{creditos.length}</span></div></div></div>
            <div className="pt-4 border-t border-border"><p className="text-sm text-muted-foreground mb-3">Cobertura de créditos</p><div className="space-y-2"><div className="flex items-center justify-between text-sm"><span>Crédito / Débito</span><span>{((totalCreditos / icmsData.icmsDevido) * 100).toFixed(0)}%</span></div><Progress value={Math.min((totalCreditos / icmsData.icmsDevido) * 100, 100)} className="h-2" /></div></div>
            <div className="space-y-2"><Button className="w-full gap-2" variant="outline" onClick={() => setRecommendationOpen(true)}><Lightbulb className="h-4 w-4" />Ver Recomendações</Button><Button className="w-full gap-2" onClick={handleNewCredit}><Plus className="h-4 w-4" />Adicionar Crédito Manual</Button></div>
          </div>
        </ModuleCard>
      </div>
      <div className="mt-6">
        <ModuleCard title="Créditos de ICMS Cadastrados" description="Créditos do período atual" icon={FileText} noPadding actions={<Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" />Exportar</Button>}>
          <Table><TableHeader><TableRow className="bg-secondary/30"><TableHead>NF</TableHead><TableHead>Empresa</TableHead><TableHead>NCM</TableHead><TableHead>Descrição</TableHead><TableHead>UF</TableHead><TableHead className="text-right">Valor Total</TableHead><TableHead className="text-right">Alíq.</TableHead><TableHead className="text-right">Crédito</TableHead><TableHead className="text-center">Data</TableHead><TableHead className="text-center">Ações</TableHead></TableRow></TableHeader>
            <TableBody>{creditos.length === 0 ? (<TableRow><TableCell colSpan={10} className="text-center py-8"><p className="text-muted-foreground">Nenhum crédito cadastrado. Importe XMLs de NF-e ou adicione manualmente.</p></TableCell></TableRow>) : creditos.map((credito) => (<TableRow key={credito.id}><TableCell className="font-medium">{credito.numeroNF || "-"}</TableCell><TableCell><Badge variant="outline">{credito.empresa}</Badge></TableCell><TableCell className="font-mono text-xs">{credito.ncm}</TableCell><TableCell className="max-w-[200px] truncate">{credito.descricao}</TableCell><TableCell>{credito.ufOrigem}</TableCell><TableCell className="text-right">{formatCurrency(credito.valorTotal)}</TableCell><TableCell className="text-right">{credito.aliquotaIcms}%</TableCell><TableCell className="text-right text-success font-medium">{formatCurrency(credito.valorCredito)}</TableCell><TableCell className="text-center text-muted-foreground text-sm">{formatDate(credito.dataLancamento)}</TableCell><TableCell><div className="flex items-center justify-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCredit(credito)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(credito.id)}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>))}</TableBody>
          </Table>
        </ModuleCard>
      </div>
      <div className="mt-6">
        <ModuleCard title="Histórico de ICMS" description="Créditos e débitos por período" icon={FileText} noPadding>
          <Table><TableHeader><TableRow className="bg-secondary/30"><TableHead>Período</TableHead><TableHead className="text-right">Crédito</TableHead><TableHead className="text-right">Débito</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
            <TableBody>{icmsData.historico.map((item) => (<TableRow key={item.month}><TableCell className="font-medium">{item.month}/2024</TableCell><TableCell className="text-right text-success">+{formatCurrency(item.credito)}</TableCell><TableCell className="text-right text-destructive">-{formatCurrency(item.debito)}</TableCell><TableCell className={`text-right font-medium ${item.saldo >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(item.saldo)}</TableCell><TableCell className="text-center">{item.saldo >= 0 ? <Badge className="bg-success/10 text-success border-success/20">Compensado</Badge> : <Badge className="bg-destructive/10 text-destructive border-destructive/20">A pagar</Badge>}</TableCell></TableRow>))}</TableBody>
          </Table>
        </ModuleCard>
      </div>
      <XMLImportModal open={xmlImportOpen} onOpenChange={setXmlImportOpen} onImportSuccess={handleImportSuccess} existingKeys={existingKeys} />
      <ICMSCalculatorModal open={calculatorOpen} onOpenChange={setCalculatorOpen} onSave={handleSaveCredit} editingCredit={editingCredit} />
      <ICMSRecommendationModal open={recommendationOpen} onOpenChange={setRecommendationOpen} recommendation={recommendation} periodo="Outubro/2024" />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir este crédito de ICMS? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </MainLayout>
  );
}
