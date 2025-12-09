import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Link2, 
  Unlink, 
  RefreshCw, 
  Settings, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Store,
  CreditCard,
  Building2,
  Loader2,
  ExternalLink,
  History,
  Filter
} from "lucide-react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useIntegracoes, Provider, IntegracaoStatus } from "@/hooks/useIntegracoes";
import { useIntegracaoLogs, IntegracaoLogsFilters } from "@/hooks/useIntegracaoLogs";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Definição dos providers disponíveis
const PROVIDERS = [
  {
    id: "mercado_livre" as Provider,
    name: "Mercado Livre",
    description: "Sincronize vendas, comissões e fretes automaticamente",
    icon: Store,
    color: "bg-yellow-500",
    available: true,
  },
  {
    id: "shopee" as Provider,
    name: "Shopee",
    description: "Importe transações e taxas da Shopee",
    icon: Store,
    color: "bg-orange-500",
    available: false, // Em breve
  },
  {
    id: "nubank" as Provider,
    name: "Nubank",
    description: "Sincronize extratos e faturas em tempo real",
    icon: CreditCard,
    color: "bg-purple-500",
    available: false,
  },
  {
    id: "itau" as Provider,
    name: "Itaú",
    description: "Conecte sua conta para conciliação automática",
    icon: Building2,
    color: "bg-blue-500",
    available: false,
  },
];

export default function Integracoes() {
  const [empresaId, setEmpresaId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  // Filtros para a aba Histórico
  const [historicoFilters, setHistoricoFilters] = useState<IntegracaoLogsFilters>({
    provider: "todos",
    periodo: "30d",
  });

  const { empresas, isLoading: loadingEmpresas } = useEmpresas();
  const { 
    logs, 
    isLoading, 
    getIntegracaoStatus, 
    disconnect, 
    upsertConfig,
    startMercadoLivreOAuth,
    syncManually 
  } = useIntegracoes({ empresaId });

  // Hook para logs filtrados na aba Histórico
  const { 
    logs: historicoLogs, 
    isLoading: loadingHistorico, 
    error: historicoError,
    refetch: refetchHistorico 
  } = useIntegracaoLogs(empresaId, historicoFilters);

  // Auto-selecionar primeira empresa
  useEffect(() => {
    if (empresas?.length && !empresaId) {
      setEmpresaId(empresas[0].id);
    }
  }, [empresas, empresaId]);

  // Detectar parâmetro ml_status na URL (callback do OAuth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mlStatus = params.get('ml_status');
    const provider = params.get('provider');
    
    if (mlStatus) {
      if (mlStatus === 'success') {
        toast.success(`${provider === 'mercado_livre' ? 'Mercado Livre' : provider} conectado com sucesso!`);
      } else if (mlStatus === 'error') {
        toast.error(`Erro ao conectar ${provider === 'mercado_livre' ? 'Mercado Livre' : provider}. Tente novamente.`);
      }
      
      // Limpar parâmetros da URL sem recarregar página
      window.history.replaceState({}, '', '/integracoes');
    }
  }, []);

  const handleConnect = async (provider: Provider) => {
    if (!empresaId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }

    setIsConnecting(true);
    try {
      if (provider === "mercado_livre") {
        await startMercadoLivreOAuth(empresaId);
      }
      // Outros providers serão implementados depois
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast.error("Erro ao iniciar conexão");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (selectedProvider && empresaId) {
      disconnect.mutate({ empresaId, provider: selectedProvider });
      setDisconnectDialogOpen(false);
      setSelectedProvider(null);
    }
  };

  const handleSync = (provider: Provider) => {
    if (empresaId) {
      syncManually.mutate({ empresaId, provider });
    }
  };

  const handleSaveConfig = (provider: Provider, config: Record<string, unknown>) => {
    if (empresaId) {
      upsertConfig.mutate({
        empresa_id: empresaId,
        provider,
        ...config,
      });
      setConfigDialogOpen(false);
    }
  };

  const getStatusBadge = (status: IntegracaoStatus) => {
    if (!status.connected) {
      return <Badge variant="outline" className="text-muted-foreground">Desconectado</Badge>;
    }
    if (status.config?.ativo === false) {
      return <Badge variant="secondary">Pausado</Badge>;
    }
    return <Badge className="bg-green-500 hover:bg-green-600">Conectado</Badge>;
  };

  const getLogStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const providerLogs = selectedProvider 
    ? logs?.filter(l => l.provider === selectedProvider) || []
    : logs || [];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold">Integrações</h1>
                <p className="text-muted-foreground">
                  Conecte marketplaces e bancos para automatizar sua operação
                </p>
              </div>

              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas?.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome_fantasia || empresa.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="conexoes" className="space-y-6">
              <TabsList>
                <TabsTrigger value="conexoes">
                  <Link2 className="h-4 w-4 mr-2" />
                  Conexões
                </TabsTrigger>
                <TabsTrigger value="historico">
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              {/* Tab Conexões */}
              <TabsContent value="conexoes" className="space-y-6">
                {!empresaId ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Selecione uma empresa para gerenciar integrações
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    {PROVIDERS.map((provider) => {
                      const status = getIntegracaoStatus(provider.id);
                      const ProviderIcon = provider.icon;

                      return (
                        <Card key={provider.id} className={!provider.available ? "opacity-60" : ""}>
                          <CardHeader className="flex flex-row items-center gap-4">
                            <div className={`p-3 rounded-lg ${provider.color}`}>
                              <ProviderIcon className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">{provider.name}</CardTitle>
                                {!provider.available && (
                                  <Badge variant="outline" className="text-xs">Em breve</Badge>
                                )}
                              </div>
                              <CardDescription>{provider.description}</CardDescription>
                            </div>
                            {getStatusBadge(status)}
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {status.connected && (
                              <div className="text-sm text-muted-foreground space-y-1">
                                {status.lastSync && (
                                  <p>
                                    Última sync: {formatDistanceToNow(new Date(status.lastSync.created_at), { 
                                      addSuffix: true, 
                                      locale: ptBR 
                                    })}
                                  </p>
                                )}
                                {status.config?.sync_frequency_minutes && (
                                  <p>Frequência: a cada {status.config.sync_frequency_minutes} min</p>
                                )}
                              </div>
                            )}

                            <div className="flex gap-2">
                              {!status.connected ? (
                                <Button 
                                  className="flex-1" 
                                  onClick={() => handleConnect(provider.id)}
                                  disabled={!provider.available || isLoading || isConnecting}
                                >
                                  {isConnecting ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Link2 className="h-4 w-4 mr-2" />
                                  )}
                                  {isConnecting ? "Conectando..." : "Conectar"}
                                </Button>
                              ) : (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="icon"
                                    onClick={() => handleSync(provider.id)}
                                    disabled={syncManually.isPending}
                                  >
                                    {syncManually.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="icon"
                                    onClick={() => {
                                      setSelectedProvider(provider.id);
                                      setConfigDialogOpen(true);
                                    }}
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="icon"
                                    onClick={() => {
                                      setSelectedProvider(provider.id);
                                      setDisconnectDialogOpen(true);
                                    }}
                                  >
                                    <Unlink className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Tab Histórico */}
              <TabsContent value="historico" className="space-y-4">
                {/* Filtros */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Filter className="h-5 w-5" />
                          Histórico de Sincronizações
                        </CardTitle>
                        <CardDescription>
                          Visualize as sincronizações realizadas por canal e período
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={refetchHistorico}
                        disabled={loadingHistorico}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingHistorico ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-4">
                      {/* Filtro de Canal */}
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-sm text-muted-foreground">Canal</Label>
                        <Select 
                          value={historicoFilters.provider || "todos"} 
                          onValueChange={(value) => setHistoricoFilters(prev => ({ ...prev, provider: value }))}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Selecione o canal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                            <SelectItem value="shopee">Shopee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filtro de Período */}
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-sm text-muted-foreground">Período</Label>
                        <Select 
                          value={historicoFilters.periodo || "30d"} 
                          onValueChange={(value) => setHistoricoFilters(prev => ({ 
                            ...prev, 
                            periodo: value as "7d" | "30d" | "90d" 
                          }))}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Selecione o período" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7d">Últimos 7 dias</SelectItem>
                            <SelectItem value="30d">Últimos 30 dias</SelectItem>
                            <SelectItem value="90d">Últimos 90 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabela de Logs */}
                <Card>
                  <CardContent className="pt-6">
                    {!empresaId ? (
                      <div className="py-12 text-center text-muted-foreground">
                        Selecione uma empresa para visualizar o histórico de sincronizações
                      </div>
                    ) : historicoError ? (
                      <div className="py-12 text-center">
                        <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                        <p className="text-destructive">{historicoError}</p>
                        <Button variant="outline" className="mt-4" onClick={refetchHistorico}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : loadingHistorico ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : historicoLogs.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma sincronização encontrada para os filtros selecionados.</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <TooltipProvider>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data/Hora</TableHead>
                                <TableHead>Canal</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">Processados</TableHead>
                                <TableHead className="text-center">Criados</TableHead>
                                <TableHead className="text-center">Atualizados</TableHead>
                                <TableHead className="text-center">Erros</TableHead>
                                <TableHead>Mensagem</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {historicoLogs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                  </TableCell>
                                  <TableCell>
                                    {/* Mapeamento de provider para nome legível */}
                                    {log.provider === "mercado_livre" ? "Mercado Livre" : 
                                     log.provider === "shopee" ? "Shopee" : 
                                     log.provider.replace("_", " ")}
                                  </TableCell>
                                  <TableCell>
                                    {/* Mapeamento de tipo para texto legível */}
                                    {log.tipo === "sync" ? "Sincronização Manual" :
                                     log.tipo === "webhook" ? "Webhook" :
                                     log.tipo === "oauth" ? "Autenticação" :
                                     log.tipo}
                                  </TableCell>
                                  <TableCell>
                                    {/* Badge de status com cores */}
                                    {log.status === "success" ? (
                                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Sucesso
                                      </Badge>
                                    ) : log.status === "error" ? (
                                      <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Erro
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Pendente
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {log.registros_processados ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {log.registros_criados != null && log.registros_criados > 0 ? (
                                      <span className="text-green-600 font-medium">+{log.registros_criados}</span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {log.registros_atualizados != null && log.registros_atualizados > 0 ? (
                                      <span className="text-blue-600 font-medium">~{log.registros_atualizados}</span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {log.registros_erro != null && log.registros_erro > 0 ? (
                                      <span className="text-destructive font-medium">{log.registros_erro}</span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="max-w-[200px]">
                                    {log.mensagem ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="truncate block cursor-help">
                                            {log.mensagem}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="max-w-[300px]">
                                          <p className="text-sm">{log.mensagem}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TooltipProvider>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Dialog de Configuração */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações da Integração</DialogTitle>
            <DialogDescription>
              Ajuste as opções de sincronização
            </DialogDescription>
          </DialogHeader>
          {selectedProvider && (
            <ConfigForm 
              provider={selectedProvider}
              status={getIntegracaoStatus(selectedProvider)}
              onSave={(config) => handleSaveConfig(selectedProvider, config)}
              onCancel={() => setConfigDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Desconexão */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar Integração</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desconectar esta integração? 
              Os dados já importados serão mantidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDisconnect}>
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

// Componente de formulário de configuração
function ConfigForm({ 
  provider, 
  status, 
  onSave, 
  onCancel 
}: { 
  provider: Provider;
  status: IntegracaoStatus;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [ativo, setAtivo] = useState(status.config?.ativo ?? true);
  const [syncFrequency, setSyncFrequency] = useState(status.config?.sync_frequency_minutes ?? 30);
  const [autoCategorize, setAutoCategorize] = useState(status.config?.auto_categorize ?? true);
  const [autoReconcile, setAutoReconcile] = useState(status.config?.auto_reconcile ?? false);

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Integração Ativa</Label>
          <p className="text-sm text-muted-foreground">
            Pausar/ativar sincronização automática
          </p>
        </div>
        <Switch checked={ativo} onCheckedChange={setAtivo} />
      </div>

      <div className="space-y-2">
        <Label>Frequência de Sincronização</Label>
        <Select value={String(syncFrequency)} onValueChange={(v) => setSyncFrequency(Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">A cada 15 minutos</SelectItem>
            <SelectItem value="30">A cada 30 minutos</SelectItem>
            <SelectItem value="60">A cada 1 hora</SelectItem>
            <SelectItem value="120">A cada 2 horas</SelectItem>
            <SelectItem value="360">A cada 6 horas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Auto-categorizar</Label>
          <p className="text-sm text-muted-foreground">
            Aplicar regras de categorização automaticamente
          </p>
        </div>
        <Switch checked={autoCategorize} onCheckedChange={setAutoCategorize} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Auto-conciliar</Label>
          <p className="text-sm text-muted-foreground">
            Conciliar transações automaticamente após categorização
          </p>
        </div>
        <Switch checked={autoReconcile} onCheckedChange={setAutoReconcile} />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave({
          ativo,
          sync_frequency_minutes: syncFrequency,
          auto_categorize: autoCategorize,
          auto_reconcile: autoReconcile,
        })}>
          Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}
