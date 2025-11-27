import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDetailModal } from '@/components/assistant/AlertDetailModal';
import { AssistantCharacter } from '@/components/assistant/AssistantCharacter';
import { useAssistantEngine } from '@/hooks/useAssistantEngine';
import {
  AssistantAlert,
  AlertCategory,
  AlertStatus,
  CATEGORY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  formatRelativeTime,
} from '@/lib/assistant-data';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  RefreshCw,
  Search,
  XCircle,
  TrendingUp,
  Shield,
  FileText,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AssistantCenter() {
  const {
    alerts,
    config,
    isAnalyzing,
    lastAnalysis,
    updateAlertStatus,
    silenceFor,
    unsilence,
    runAnalysis,
    getUnreadCount,
  } = useAssistantEngine();

  const [selectedAlert, setSelectedAlert] = useState<AssistantAlert | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('todos');

  const isSilenced = config.silenciado && config.silenciadoAte && new Date() < config.silenciadoAte;

  // Estatísticas
  const stats = useMemo(() => {
    const novos = alerts.filter(a => a.status === 'novo').length;
    const emAnalise = alerts.filter(a => a.status === 'em_analise').length;
    const resolvidos = alerts.filter(a => a.status === 'resolvido').length;
    const criticos = alerts.filter(a => a.severidade === 'critico' && a.status === 'novo').length;
    
    return { novos, emAnalise, resolvidos, criticos };
  }, [alerts]);

  // Empresas únicas para filtro
  const empresas = useMemo(() => {
    const unique = [...new Set(alerts.map(a => a.empresa).filter(Boolean))];
    return unique as string[];
  }, [alerts]);

  // Alertas filtrados
  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    // Filtro por tab
    if (activeTab === 'novos') {
      result = result.filter(a => a.status === 'novo');
    } else if (activeTab === 'em_analise') {
      result = result.filter(a => a.status === 'em_analise');
    } else if (activeTab === 'resolvidos') {
      result = result.filter(a => a.status === 'resolvido' || a.status === 'ignorado');
    }

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.titulo.toLowerCase().includes(term) ||
        a.descricao.toLowerCase().includes(term)
      );
    }

    // Filtro por categoria
    if (filterCategoria !== 'all') {
      result = result.filter(a => a.categoria === filterCategoria);
    }

    // Filtro por status
    if (filterStatus !== 'all') {
      result = result.filter(a => a.status === filterStatus);
    }

    // Filtro por empresa
    if (filterEmpresa !== 'all') {
      result = result.filter(a => a.empresa === filterEmpresa);
    }

    // Ordenar por severidade e data
    const severityOrder = ['critico', 'alto', 'medio', 'baixo', 'informativo'];
    result.sort((a, b) => {
      const sevDiff = severityOrder.indexOf(a.severidade) - severityOrder.indexOf(b.severidade);
      if (sevDiff !== 0) return sevDiff;
      return b.dataDeteccao.getTime() - a.dataDeteccao.getTime();
    });

    return result;
  }, [alerts, activeTab, searchTerm, filterCategoria, filterStatus, filterEmpresa]);

  const handleViewDetails = (alert: AssistantAlert) => {
    setSelectedAlert(alert);
    setDetailModalOpen(true);
  };

  const handleResolve = (alertId: string) => {
    updateAlertStatus(alertId, 'resolvido');
    setDetailModalOpen(false);
  };

  const handleIgnore = (alertId: string) => {
    updateAlertStatus(alertId, 'ignorado');
    setDetailModalOpen(false);
  };

  const handleAnalyze = (alertId: string) => {
    updateAlertStatus(alertId, 'em_analise');
  };

  return (
    <MainLayout
      title="Central de Alertas"
      subtitle="Assis.Fin - Seu assistente financeiro inteligente"
      actions={
        <div className="flex items-center gap-2">
          {isSilenced ? (
            <Button variant="outline" onClick={unsilence} className="gap-2">
              <BellOff className="w-4 h-4" />
              Reativar Alertas
            </Button>
          ) : (
            <Button variant="outline" onClick={() => silenceFor(60)} className="gap-2">
              <BellOff className="w-4 h-4" />
              Silenciar 1h
            </Button>
          )}
          <Button onClick={runAnalysis} disabled={isAnalyzing} className="gap-2">
            <RefreshCw className={cn('w-4 h-4', isAnalyzing && 'animate-spin')} />
            {isAnalyzing ? 'Analisando...' : 'Executar Análise'}
          </Button>
        </div>
      }
    >
      {/* Header com personagem */}
      <div className="mb-6 p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl border">
        <div className="flex items-center gap-6">
          <AssistantCharacter size="lg" mood={isAnalyzing ? 'thinking' : stats.criticos > 0 ? 'critico' : 'neutral'} />
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">Olá! Sou o Assis.Fin</h2>
            <p className="text-muted-foreground">
              {isAnalyzing 
                ? 'Estou analisando seus dados financeiros, fiscais e operacionais...'
                : stats.criticos > 0 
                  ? `Detectei ${stats.criticos} alerta(s) crítico(s) que precisam de atenção imediata.`
                  : stats.novos > 0 
                    ? `Você tem ${stats.novos} alerta(s) pendente(s) para revisar.`
                    : 'Tudo sob controle! Continue monitorando regularmente.'
              }
            </p>
            {lastAnalysis && (
              <p className="text-xs text-muted-foreground mt-1">
                Última análise: {formatRelativeTime(lastAnalysis)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.novos}</p>
                <p className="text-sm text-muted-foreground">Alertas Novos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emAnalise}</p>
                <p className="text-sm text-muted-foreground">Em Análise</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolvidos}</p>
                <p className="text-sm text-muted-foreground">Resolvidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.criticos}</p>
                <p className="text-sm text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs e Filtros */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="p-4 border-b">
            <div className="flex flex-col lg:flex-row gap-4 justify-between">
              <TabsList>
                <TabsTrigger value="todos" className="gap-2">
                  <Bell className="w-4 h-4" />
                  Todos
                </TabsTrigger>
                <TabsTrigger value="novos" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Novos ({stats.novos})
                </TabsTrigger>
                <TabsTrigger value="em_analise" className="gap-2">
                  <Clock className="w-4 h-4" />
                  Em Análise ({stats.emAnalise})
                </TabsTrigger>
                <TabsTrigger value="resolvidos" className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Resolvidos
                </TabsTrigger>
              </TabsList>

              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar alertas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>

                <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas empresas</SelectItem>
                    {empresas.map(emp => (
                      <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <TabsContent value={activeTab} className="m-0">
            {filteredAlerts.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum alerta encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'todos' 
                    ? 'Ajuste os filtros ou execute uma nova análise.'
                    : `Não há alertas com status "${activeTab}" no momento.`
                  }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Alerta</TableHead>
                    <TableHead className="w-32">Categoria</TableHead>
                    <TableHead className="w-24">Severidade</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-32">Empresa</TableHead>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map(alert => {
                    const categoryConfig = CATEGORY_CONFIG[alert.categoria];
                    const severityConfig = SEVERITY_CONFIG[alert.severidade];
                    const statusConfig = STATUS_CONFIG[alert.status];

                    return (
                      <TableRow 
                        key={alert.id} 
                        className={cn(
                          'cursor-pointer hover:bg-muted/50',
                          alert.status === 'novo' && alert.severidade === 'critico' && 'bg-red-50/50'
                        )}
                        onClick={() => handleViewDetails(alert)}
                      >
                        <TableCell>
                          <div className={cn(
                            'w-3 h-3 rounded-full',
                            severityConfig.bgColor.replace('-100', '-500')
                          )} />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{alert.titulo}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {alert.descricao}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={categoryConfig.color}>
                            {categoryConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(severityConfig.bgColor, severityConfig.color, 'border', severityConfig.borderColor)}>
                            {severityConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {alert.empresa || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeTime(alert.dataDeteccao)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleViewDetails(alert)}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            {alert.status === 'novo' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                onClick={() => handleResolve(alert.id)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Modal de detalhes */}
      <AlertDetailModal
        alert={selectedAlert}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onResolve={handleResolve}
        onIgnore={handleIgnore}
        onAnalyze={handleAnalyze}
      />
    </MainLayout>
  );
}
