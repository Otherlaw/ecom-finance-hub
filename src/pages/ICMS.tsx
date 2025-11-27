import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { icmsData } from "@/lib/mock-data";
import { 
  mockCreditosICMS, calculateRecommendation, formatCurrency, formatDate, 
  CreditoICMS, calcularResumoEmpresa, ORIGEM_CREDITO_CONFIG, TIPO_CREDITO_CONFIG,
  OrigemCredito, TipoCreditoICMS, NotaCreditoAdquirida, mockNotasAdquiridas
} from "@/lib/icms-data";
import { mockEmpresas, REGIME_TRIBUTARIO_CONFIG, canUseICMSCredit, getEmpresaByName, Empresa } from "@/lib/empresas-data";
import { XMLImportModal } from "@/components/icms/XMLImportModal";
import { ICMSCalculatorModal } from "@/components/icms/ICMSCalculatorModal";
import { ICMSRecommendationModal } from "@/components/icms/ICMSRecommendationModal";
import { CreditoAdquiridoModal } from "@/components/icms/CreditoAdquiridoModal";
import { 
  Receipt, Download, AlertTriangle, TrendingUp, TrendingDown, Calculator, 
  FileText, Upload, Plus, Lightbulb, Trash2, Edit2, Info, Building2, 
  CheckCircle2, XCircle, Filter, ShoppingBag
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function ICMS() {
  const [xmlImportOpen, setXmlImportOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const [creditoAdquiridoOpen, setCreditoAdquiridoOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditos, setCreditos] = useState<CreditoICMS[]>(mockCreditosICMS);
  const [notasAdquiridas, setNotasAdquiridas] = useState<NotaCreditoAdquirida[]>(mockNotasAdquiridas);
  const [editingCredit, setEditingCredit] = useState<CreditoICMS | null>(null);
  const [deletingCreditId, setDeletingCreditId] = useState<string | null>(null);
  
  // Filters
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [origemFilter, setOrigemFilter] = useState<string>("todas");

  const empresas = mockEmpresas;
  const selectedEmpresa = useMemo(() => {
    if (empresaFilter === "todas") return null;
    return empresas.find(e => e.nome.toUpperCase().includes(empresaFilter.toUpperCase()));
  }, [empresaFilter, empresas]);

  const isSimples = selectedEmpresa?.regimeTributario === 'simples_nacional';
  const canUseCredits = selectedEmpresa ? canUseICMSCredit(selectedEmpresa.regimeTributario) : true;

  // Filter creditos
  const filteredCreditos = useMemo(() => {
    return creditos.filter(c => {
      const matchEmpresa = empresaFilter === "todas" || c.empresa.toUpperCase().includes(empresaFilter.toUpperCase());
      const matchTipo = tipoFilter === "todos" || c.tipoCredito === tipoFilter;
      const matchOrigem = origemFilter === "todas" || c.origemCredito === origemFilter;
      return matchEmpresa && matchTipo && matchOrigem && c.statusCredito === 'ativo';
    });
  }, [creditos, empresaFilter, tipoFilter, origemFilter]);

  // Separate compensable and non-compensable
  const creditosCompensaveis = useMemo(() => 
    filteredCreditos.filter(c => c.tipoCredito === 'compensavel'), [filteredCreditos]);
  const creditosNaoCompensaveis = useMemo(() => 
    filteredCreditos.filter(c => c.tipoCredito === 'nao_compensavel'), [filteredCreditos]);

  // Calculate totals
  const totalCompensaveis = useMemo(() => 
    creditosCompensaveis.reduce((sum, c) => sum + c.valorCredito, 0), [creditosCompensaveis]);
  const totalNaoCompensaveis = useMemo(() => 
    creditosNaoCompensaveis.reduce((sum, c) => sum + c.valorCredito, 0), [creditosNaoCompensaveis]);

  // Get resumos per empresa (only regime normal)
  const resumosEmpresa = useMemo(() => {
    const empresasNormais = empresas.filter(e => canUseICMSCredit(e.regimeTributario));
    return empresasNormais.map(emp => 
      calcularResumoEmpresa(creditos, emp.nome.split(' ')[0].toUpperCase(), icmsData.icmsDevido / empresasNormais.length)
    );
  }, [creditos, empresas]);

  // Recommendation
  const recommendation = useMemo(() => {
    if (isSimples) return null;
    const creditosParaCalculo = empresaFilter === "todas" 
      ? creditos.filter(c => c.tipoCredito === 'compensavel' && c.statusCredito === 'ativo').reduce((s,c) => s + c.valorCredito, 0)
      : totalCompensaveis;
    return calculateRecommendation(icmsData.icmsDevido, creditosParaCalculo, totalNaoCompensaveis, 8);
  }, [isSimples, empresaFilter, creditos, totalCompensaveis, totalNaoCompensaveis]);

  const saldoProjetado = canUseCredits ? totalCompensaveis - icmsData.icmsDevido : 0;
  const saldoNegativo = canUseCredits && saldoProjetado < 0;

  const existingKeys = useMemo(() => creditos.filter((c) => c.chaveAcesso).map((c) => c.chaveAcesso!), [creditos]);

  const handleImportSuccess = (newCredits: CreditoICMS[]) => setCreditos((prev) => [...prev, ...newCredits]);
  
  const handleSaveCredit = (credit: CreditoICMS) => { 
    if (editingCredit) { 
      setCreditos((prev) => prev.map((c) => (c.id === credit.id ? credit : c))); 
    } else { 
      setCreditos((prev) => [...prev, credit]); 
    } 
    setEditingCredit(null); 
  };

  const handleSaveCreditoAdquirido = (credit: CreditoICMS, nota: NotaCreditoAdquirida) => {
    setCreditos((prev) => [...prev, credit]);
    setNotasAdquiridas((prev) => [...prev, nota]);
  };
  
  const handleEditCredit = (credit: CreditoICMS) => { 
    setEditingCredit(credit); 
    setCalculatorOpen(true); 
  };
  
  const handleDeleteClick = (id: string) => { 
    setDeletingCreditId(id); 
    setDeleteDialogOpen(true); 
  };
  
  const handleConfirmDelete = () => { 
    if (deletingCreditId) { 
      setCreditos((prev) => prev.filter((c) => c.id !== deletingCreditId)); 
      toast.success("Crédito excluído com sucesso."); 
    } 
    setDeleteDialogOpen(false); 
    setDeletingCreditId(null); 
  };
  
  const handleNewCredit = () => { 
    setEditingCredit(null); 
    setCalculatorOpen(true); 
  };

  const getEmpresaRegimeInfo = (empresaNome: string) => {
    const emp = getEmpresaByName(empresas, empresaNome);
    if (!emp) return null;
    return REGIME_TRIBUTARIO_CONFIG[emp.regimeTributario];
  };

  return (
    <MainLayout 
      title="Controle de Crédito de ICMS" 
      subtitle="Gestão de créditos compensáveis e não compensáveis" 
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setXmlImportOpen(true)}>
            <Upload className="h-4 w-4" />Importar XML
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setCreditoAdquiridoOpen(true)}>
            <ShoppingBag className="h-4 w-4" />Nota Adquirida
          </Button>
          <Button className="gap-2" onClick={handleNewCredit}>
            <Calculator className="h-4 w-4" />Novo Crédito
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4 p-4 rounded-lg bg-secondary/30 border">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filtros:</span>
        </div>
        <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {empresas.map((emp) => (
              <SelectItem key={emp.id} value={emp.nome.split(' ')[0].toUpperCase()}>
                {emp.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de Crédito" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="compensavel">Compensável</SelectItem>
            <SelectItem value="nao_compensavel">Não Compensável</SelectItem>
          </SelectContent>
        </Select>
        <Select value={origemFilter} onValueChange={setOrigemFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            {(Object.keys(ORIGEM_CREDITO_CONFIG) as OrigemCredito[]).map((origem) => (
              <SelectItem key={origem} value={origem}>
                {ORIGEM_CREDITO_CONFIG[origem].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedEmpresa && (
          <Badge variant="outline" className={`${REGIME_TRIBUTARIO_CONFIG[selectedEmpresa.regimeTributario].bgColor} ${REGIME_TRIBUTARIO_CONFIG[selectedEmpresa.regimeTributario].color} border`}>
            {REGIME_TRIBUTARIO_CONFIG[selectedEmpresa.regimeTributario].label}
          </Badge>
        )}
      </div>

      {/* Simples Nacional Warning */}
      {isSimples && (
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Info className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-800">Empresa no Simples Nacional</AlertTitle>
          <AlertDescription className="text-blue-700">
            Créditos de ICMS desta empresa são classificados como <strong>Não Compensáveis</strong> e não entram no cálculo de compensação tributária. São apenas para controle interno.
          </AlertDescription>
        </Alert>
      )}

      {/* Negative Balance Warning */}
      {!isSimples && saldoNegativo && (
        <Alert className="mb-6 bg-warning/10 border-warning/30">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <AlertTitle className="text-warning">Atenção: Saldo de ICMS Negativo</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Faltam créditos compensáveis para cobrir o ICMS devido. Considere adquirir notas com crédito.
            <Button variant="link" className="p-0 h-auto ml-2 text-warning" onClick={() => setRecommendationOpen(true)}>
              Ver Recomendação
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard 
          title="Créditos Compensáveis" 
          value={formatCurrency(totalCompensaveis)} 
          icon={CheckCircle2} 
          iconColor="text-success" 
          trend="up"
          changeLabel={`${creditosCompensaveis.length} registros`}
        />
        <KPICard 
          title="Créditos Não Compensáveis" 
          value={formatCurrency(totalNaoCompensaveis)} 
          icon={Info} 
          iconColor="text-blue-500" 
          trend="neutral"
          changeLabel="Apenas informativo"
        />
        <KPICard 
          title="ICMS Devido" 
          value={formatCurrency(canUseCredits ? icmsData.icmsDevido : 0)} 
          icon={TrendingDown} 
          iconColor={isSimples ? "text-muted-foreground" : "text-destructive"} 
          trend={isSimples ? "neutral" : "down"}
        />
        <KPICard 
          title="Saldo Projetado" 
          value={canUseCredits ? formatCurrency(saldoProjetado) : "N/A"} 
          icon={Receipt} 
          iconColor={saldoProjetado >= 0 ? "text-success" : "text-destructive"}
          trend={isSimples ? "neutral" : (saldoProjetado >= 0 ? "up" : "down")} 
        />
      </div>

      {/* Resumos por Empresa (Regime Normal) */}
      {empresaFilter === "todas" && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Resumo por Empresa (Regime Normal)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resumosEmpresa.map((resumo) => (
              <div key={resumo.empresaId} className="p-4 rounded-xl border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{resumo.empresaNome}</span>
                    <Badge variant="outline" className={`${REGIME_TRIBUTARIO_CONFIG[resumo.regimeTributario].bgColor} ${REGIME_TRIBUTARIO_CONFIG[resumo.regimeTributario].color} border text-xs`}>
                      {REGIME_TRIBUTARIO_CONFIG[resumo.regimeTributario].shortLabel}
                    </Badge>
                  </div>
                  <Badge variant={resumo.saldoICMS >= 0 ? "default" : "destructive"} className={resumo.saldoICMS >= 0 ? "bg-success/10 text-success border-success/20" : ""}>
                    {resumo.saldoICMS >= 0 ? "OK" : "Insuficiente"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Créditos Brutos</p>
                    <p className="font-medium text-success">{formatCurrency(resumo.creditosBrutos)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ICMS Débito</p>
                    <p className="font-medium text-destructive">{formatCurrency(resumo.icmsDebito)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Saldo</p>
                    <p className={`font-medium ${resumo.saldoICMS >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(resumo.saldoICMS)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Cobertura</span>
                    <span>{Math.min(resumo.percentualCobertura, 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={Math.min(resumo.percentualCobertura, 100)} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Créditos Compensáveis */}
      <div className="mb-6">
        <ModuleCard 
          title="Créditos Compensáveis (Regime Normal)" 
          description="Créditos válidos para compensação de ICMS devido"
          icon={CheckCircle2}
          noPadding
          actions={
            <Badge className="bg-success/10 text-success border-success/20">
              Total: {formatCurrency(totalCompensaveis)}
            </Badge>
          }
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-success/5">
                <TableHead>NF</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>UF</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-center">Data</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditosCompensaveis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum crédito compensável encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                creditosCompensaveis.map((credito) => (
                  <TableRow key={credito.id}>
                    <TableCell className="font-medium">{credito.numeroNF || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{credito.empresa}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${ORIGEM_CREDITO_CONFIG[credito.origemCredito].bgColor} ${ORIGEM_CREDITO_CONFIG[credito.origemCredito].color} text-xs`}>
                        {ORIGEM_CREDITO_CONFIG[credito.origemCredito].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{credito.descricao}</TableCell>
                    <TableCell>{credito.ufOrigem}</TableCell>
                    <TableCell className="text-right">{formatCurrency(credito.valorTotal)}</TableCell>
                    <TableCell className="text-right text-success font-medium">{formatCurrency(credito.valorCredito)}</TableCell>
                    <TableCell className="text-center text-muted-foreground text-sm">{formatDate(credito.dataLancamento)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCredit(credito)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick(credito.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleCard>
      </div>

      {/* Créditos Não Compensáveis */}
      {creditosNaoCompensaveis.length > 0 && (
        <div className="mb-6">
          <ModuleCard 
            title="Créditos Não Compensáveis (Informativos)" 
            description="Créditos de empresas no Simples Nacional ou outros não utilizáveis para compensação"
            icon={Info}
            noPadding
            actions={
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                Total: {formatCurrency(totalNaoCompensaveis)}
              </Badge>
            }
          >
            <Alert className="m-4 bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 text-sm">
                Estes créditos são apenas para controle interno. <strong>Não são considerados</strong> no cálculo de compensação de ICMS nem nas recomendações de compra de notas.
              </AlertDescription>
            </Alert>
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50/50">
                  <TableHead>NF</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Crédito (Info)</TableHead>
                  <TableHead className="text-center">Data</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditosNaoCompensaveis.map((credito) => (
                  <TableRow key={credito.id}>
                    <TableCell className="font-medium">{credito.numeroNF || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{credito.empresa}</Badge>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs">SN</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">{credito.descricao}</TableCell>
                    <TableCell className="text-right">{formatCurrency(credito.valorTotal)}</TableCell>
                    <TableCell className="text-right text-blue-600 font-medium">{formatCurrency(credito.valorCredito)}</TableCell>
                    <TableCell className="text-center text-muted-foreground text-sm">{formatDate(credito.dataLancamento)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCredit(credito)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick(credito.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ModuleCard>
        </div>
      )}

      {/* Recommendation Button */}
      {canUseCredits && !isSimples && (
        <div className="flex justify-center">
          <Button variant="outline" size="lg" className="gap-2" onClick={() => setRecommendationOpen(true)}>
            <Lightbulb className="h-5 w-5" />
            Ver Análise de Necessidade de Créditos
          </Button>
        </div>
      )}

      {/* Modals */}
      <XMLImportModal open={xmlImportOpen} onOpenChange={setXmlImportOpen} onImportSuccess={handleImportSuccess} existingKeys={existingKeys} />
      <ICMSCalculatorModal open={calculatorOpen} onOpenChange={setCalculatorOpen} onSave={handleSaveCredit} editingCredit={editingCredit} />
      <CreditoAdquiridoModal open={creditoAdquiridoOpen} onOpenChange={setCreditoAdquiridoOpen} onSave={handleSaveCreditoAdquirido} />
      {recommendation && (
        <ICMSRecommendationModal open={recommendationOpen} onOpenChange={setRecommendationOpen} recommendation={recommendation} periodo="Outubro/2024" />
      )}
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este crédito de ICMS?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
