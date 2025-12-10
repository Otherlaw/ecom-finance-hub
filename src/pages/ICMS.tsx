import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  calculateRecommendation, formatCurrency, formatDate, 
  ORIGEM_CREDITO_CONFIG, TIPO_CREDITO_CONFIG,
  OrigemCredito, TipoCreditoICMS
} from "@/lib/icms-data";
import { REGIME_TRIBUTARIO_CONFIG, canUseICMSCredit } from "@/lib/empresas-data";
import { XMLImportModal } from "@/components/icms/XMLImportModal";
import { ICMSCalculatorModal } from "@/components/icms/ICMSCalculatorModal";
import { ICMSRecommendationModal } from "@/components/icms/ICMSRecommendationModal";
import { AskAssistantButton } from "@/components/assistant/AskAssistantButton";
import { useAssistantChatContext } from "@/contexts/AssistantChatContext";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCreditosICMS, CreditoICMSDB, CreditoICMSInsert } from "@/hooks/useCreditosICMS";
import { 
  Receipt, AlertTriangle, TrendingDown, Calculator, 
  Upload, Lightbulb, Trash2, Edit2, Info, Building2, 
  CheckCircle2, Filter
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Mock ICMS devido (futuramente virá de integração fiscal)
const ICMS_DEVIDO_MOCK = 45000;

export default function ICMS() {
  const { openChat } = useAssistantChatContext();
  const [xmlImportOpen, setXmlImportOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCredit, setEditingCredit] = useState<CreditoICMSDB | null>(null);
  const [deletingCreditId, setDeletingCreditId] = useState<string | null>(null);
  
  // Filters
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [origemFilter, setOrigemFilter] = useState<string>("todas");

  // Hooks
  const { empresas, isLoading: empresasLoading } = useEmpresas();
  const { 
    creditos, 
    isLoading: creditosLoading, 
    existingKeys,
    createCredito,
    createMultipleCreditos,
    updateCredito,
    deleteCredito
  } = useCreditosICMS();

  const isLoading = empresasLoading || creditosLoading;

  const selectedEmpresa = useMemo(() => {
    if (empresaFilter === "todas") return null;
    return (empresas ?? []).find(e => e.id === empresaFilter);
  }, [empresaFilter, empresas]);

  const isSimples = selectedEmpresa?.regime_tributario === 'simples_nacional';
  const canUseCredits = selectedEmpresa ? canUseICMSCredit(selectedEmpresa.regime_tributario as any) : true;

  // Filter creditos
  const filteredCreditos = useMemo(() => {
    return (creditos ?? []).filter(c => {
      const matchEmpresa = empresaFilter === "todas" || c.empresa_id === empresaFilter;
      const matchTipo = tipoFilter === "todos" || c.tipo_credito === tipoFilter;
      const matchOrigem = origemFilter === "todas" || c.origem_credito === origemFilter;
      return matchEmpresa && matchTipo && matchOrigem && c.status_credito === 'ativo';
    });
  }, [creditos, empresaFilter, tipoFilter, origemFilter]);

  // Separate compensable and non-compensable
  const creditosCompensaveis = useMemo(() => 
    filteredCreditos.filter(c => c.tipo_credito === 'compensavel'), [filteredCreditos]);
  const creditosNaoCompensaveis = useMemo(() => 
    filteredCreditos.filter(c => c.tipo_credito === 'nao_compensavel'), [filteredCreditos]);

  // Calculate totals
  const totalCompensaveis = useMemo(() => 
    creditosCompensaveis.reduce((sum, c) => sum + Number(c.valor_credito), 0), [creditosCompensaveis]);
  const totalNaoCompensaveis = useMemo(() => 
    creditosNaoCompensaveis.reduce((sum, c) => sum + Number(c.valor_credito), 0), [creditosNaoCompensaveis]);

  // Get resumos per empresa (only regime normal)
  const resumosEmpresa = useMemo(() => {
    const empresasNormais = (empresas ?? []).filter(e => canUseICMSCredit(e.regime_tributario as any));
    return empresasNormais.map(emp => {
      const creditosEmp = (creditos ?? []).filter(c => 
        c.empresa_id === emp.id && c.tipo_credito === 'compensavel' && c.status_credito === 'ativo'
      );
      const total = creditosEmp.reduce((sum, c) => sum + Number(c.valor_credito), 0);
      const icmsDebito = ICMS_DEVIDO_MOCK / empresasNormais.length;
      const saldo = total - icmsDebito;
      const percentual = icmsDebito > 0 ? (total / icmsDebito) * 100 : 100;
      
      return {
        empresaId: emp.id,
        empresaNome: emp.razao_social,
        regimeTributario: emp.regime_tributario,
        creditosBrutos: total,
        icmsDebito,
        saldoICMS: saldo,
        percentualCobertura: percentual,
      };
    });
  }, [creditos, empresas]);

  // Recommendation
  const recommendation = useMemo(() => {
    if (isSimples) return null;
    const creditosParaCalculo = empresaFilter === "todas" 
      ? creditos.filter(c => c.tipo_credito === 'compensavel' && c.status_credito === 'ativo')
          .reduce((s, c) => s + Number(c.valor_credito), 0)
      : totalCompensaveis;
    return calculateRecommendation(ICMS_DEVIDO_MOCK, creditosParaCalculo, totalNaoCompensaveis, 8);
  }, [isSimples, empresaFilter, creditos, totalCompensaveis, totalNaoCompensaveis]);

  const saldoProjetado = canUseCredits ? totalCompensaveis - ICMS_DEVIDO_MOCK : 0;
  const saldoNegativo = canUseCredits && saldoProjetado < 0;

  // Handlers
  const handleImportSuccess = async (newCredits: CreditoICMSInsert[]) => {
    await createMultipleCreditos.mutateAsync(newCredits);
  };
  
  const handleSaveCredit = async (credit: any) => { 
    if (editingCredit) { 
      await updateCredito.mutateAsync({
        id: editingCredit.id,
        ...credit,
      });
    } else { 
      await createCredito.mutateAsync(credit);
    } 
    setEditingCredit(null); 
  };

  
  const handleEditCredit = (credit: CreditoICMSDB) => { 
    setEditingCredit(credit); 
    setCalculatorOpen(true); 
  };
  
  const handleDeleteClick = (id: string) => { 
    setDeletingCreditId(id); 
    setDeleteDialogOpen(true); 
  };
  
  const handleConfirmDelete = async () => { 
    if (deletingCreditId) { 
      await deleteCredito.mutateAsync(deletingCreditId);
    } 
    setDeleteDialogOpen(false); 
    setDeletingCreditId(null); 
  };
  
  const handleNewCredit = () => { 
    setEditingCredit(null); 
    setCalculatorOpen(true); 
  };

  const handleAskAssistant = () => {
    openChat('Explique a situação dos créditos de ICMS', {
      telaAtual: 'Créditos de ICMS',
      empresa: selectedEmpresa ? { nome: selectedEmpresa.razao_social, regime: selectedEmpresa.regime_tributario } : undefined,
      dadosAdicionais: {
        creditosCompensaveis: formatCurrency(totalCompensaveis),
        creditosNaoCompensaveis: formatCurrency(totalNaoCompensaveis),
        icmsDevido: formatCurrency(ICMS_DEVIDO_MOCK),
        saldoProjetado: formatCurrency(saldoProjetado),
        empresaSimples: isSimples,
      },
    });
  };

  const getEmpresaNome = (empresaId: string) => {
    const emp = empresas.find(e => e.id === empresaId);
    return emp?.razao_social || 'N/A';
  };

  if (isLoading) {
    return (
      <MainLayout title="Controle de Crédito de ICMS" subtitle="Carregando...">
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Controle de Crédito de ICMS" 
      subtitle="Gestão de créditos compensáveis e não compensáveis" 
      actions={
        <div className="flex items-center gap-2">
          <AskAssistantButton onClick={handleAskAssistant} label="Perguntar" />
          <Button variant="outline" className="gap-2" onClick={() => setXmlImportOpen(true)}>
            <Upload className="h-4 w-4" />Importar XML
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
              <SelectItem key={emp.id} value={emp.id}>
                {emp.razao_social}
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
          <Badge variant="outline" className={`${REGIME_TRIBUTARIO_CONFIG[selectedEmpresa.regime_tributario as keyof typeof REGIME_TRIBUTARIO_CONFIG]?.bgColor} ${REGIME_TRIBUTARIO_CONFIG[selectedEmpresa.regime_tributario as keyof typeof REGIME_TRIBUTARIO_CONFIG]?.color} border`}>
            {REGIME_TRIBUTARIO_CONFIG[selectedEmpresa.regime_tributario as keyof typeof REGIME_TRIBUTARIO_CONFIG]?.label}
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
          value={formatCurrency(canUseCredits ? ICMS_DEVIDO_MOCK : 0)} 
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
      {empresaFilter === "todas" && resumosEmpresa.length > 0 && (
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
                    <Badge variant="outline" className={`${REGIME_TRIBUTARIO_CONFIG[resumo.regimeTributario as keyof typeof REGIME_TRIBUTARIO_CONFIG]?.bgColor} ${REGIME_TRIBUTARIO_CONFIG[resumo.regimeTributario as keyof typeof REGIME_TRIBUTARIO_CONFIG]?.color} border text-xs`}>
                      {REGIME_TRIBUTARIO_CONFIG[resumo.regimeTributario as keyof typeof REGIME_TRIBUTARIO_CONFIG]?.shortLabel}
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
                    <TableCell className="font-medium">{credito.numero_nf || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getEmpresaNome(credito.empresa_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${ORIGEM_CREDITO_CONFIG[credito.origem_credito].bgColor} ${ORIGEM_CREDITO_CONFIG[credito.origem_credito].color} text-xs`}>
                        {ORIGEM_CREDITO_CONFIG[credito.origem_credito].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={credito.descricao}>
                      {credito.descricao}
                    </TableCell>
                    <TableCell>{credito.uf_origem || "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(credito.valor_total))}</TableCell>
                    <TableCell className="text-right text-success font-medium">{formatCurrency(Number(credito.valor_credito))}</TableCell>
                    <TableCell className="text-center">{formatDate(credito.data_lancamento)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditCredit(credito)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(credito.id)}>
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
      <div className="mb-6">
        <ModuleCard 
          title="Créditos Não Compensáveis (Informativo)" 
          description="Créditos de empresas no Simples Nacional ou não elegíveis"
          icon={Info}
          noPadding
          actions={
            <Badge className="bg-blue-50 text-blue-600 border-blue-200">
              Total: {formatCurrency(totalNaoCompensaveis)}
            </Badge>
          }
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50/50">
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
              {creditosNaoCompensaveis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum crédito não compensável encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                creditosNaoCompensaveis.map((credito) => (
                  <TableRow key={credito.id}>
                    <TableCell className="font-medium">{credito.numero_nf || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getEmpresaNome(credito.empresa_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${ORIGEM_CREDITO_CONFIG[credito.origem_credito].bgColor} ${ORIGEM_CREDITO_CONFIG[credito.origem_credito].color} text-xs`}>
                        {ORIGEM_CREDITO_CONFIG[credito.origem_credito].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={credito.descricao}>
                      {credito.descricao}
                    </TableCell>
                    <TableCell>{credito.uf_origem || "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(credito.valor_total))}</TableCell>
                    <TableCell className="text-right text-blue-600 font-medium">{formatCurrency(Number(credito.valor_credito))}</TableCell>
                    <TableCell className="text-center">{formatDate(credito.data_lancamento)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditCredit(credito)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(credito.id)}>
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

      {/* Recommendation Button */}
      {!isSimples && recommendation && !recommendation.suficiente && (
        <div className="flex justify-center mb-6">
          <Button 
            variant="outline" 
            className="gap-2 border-warning text-warning hover:bg-warning/10"
            onClick={() => setRecommendationOpen(true)}
          >
            <Lightbulb className="h-4 w-4" />
            Ver Análise de Necessidade de Créditos
          </Button>
        </div>
      )}

      {/* Modals */}
      <XMLImportModal 
        open={xmlImportOpen} 
        onOpenChange={setXmlImportOpen} 
        onImportSuccess={handleImportSuccess}
        existingKeys={existingKeys}
      />
      <ICMSCalculatorModal
        open={calculatorOpen}
        onOpenChange={setCalculatorOpen}
        onSave={handleSaveCredit}
        editingCredit={editingCredit ? {
          id: editingCredit.id,
          empresa: getEmpresaNome(editingCredit.empresa_id),
          empresaId: editingCredit.empresa_id,
          tipoCredito: editingCredit.tipo_credito,
          origemCredito: editingCredit.origem_credito,
          statusCredito: editingCredit.status_credito,
          chaveAcesso: editingCredit.chave_acesso || undefined,
          numeroNF: editingCredit.numero_nf || undefined,
          ncm: editingCredit.ncm,
          cfop: editingCredit.cfop || undefined,
          descricao: editingCredit.descricao,
          quantidade: Number(editingCredit.quantidade),
          valorUnitario: Number(editingCredit.valor_unitario),
          valorTotal: Number(editingCredit.valor_total),
          ufOrigem: editingCredit.uf_origem || '',
          aliquotaIcms: Number(editingCredit.aliquota_icms),
          valorIcmsDestacado: Number(editingCredit.valor_icms_destacado),
          percentualAproveitamento: Number(editingCredit.percentual_aproveitamento),
          valorCreditoBruto: Number(editingCredit.valor_credito_bruto),
          valorAjustes: Number(editingCredit.valor_ajustes),
          valorCredito: Number(editingCredit.valor_credito),
          dataLancamento: editingCredit.data_lancamento,
          dataCompetencia: editingCredit.data_competencia,
          observacoes: editingCredit.observacoes || undefined,
        } : null}
      />
      {recommendation && (
        <ICMSRecommendationModal
          open={recommendationOpen}
          onOpenChange={setRecommendationOpen}
          recommendation={recommendation}
          periodo={new Date().toISOString().substring(0, 7)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este crédito de ICMS? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
