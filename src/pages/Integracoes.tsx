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
  History
} from "lucide-react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useIntegracoes, Provider, IntegracaoStatus } from "@/hooks/useIntegracoes";
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

  // Auto-selecionar primeira empresa
  useEffect(() => {
    if (empresas?.length && !empresaId) {
      setEmpresaId(empresas[0].id);
    }
  }, [empresas, empresaId]);

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
              <TabsContent value="historico">
                <Card>
                  <CardHeader>
                    <CardTitle>Histórico de Sincronizações</CardTitle>
                    <CardDescription>
                      Logs das últimas 100 operações de sincronização
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Registros</TableHead>
                            <TableHead>Duração</TableHead>
                            <TableHead>Mensagem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {providerLogs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                Nenhum log encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            providerLogs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell className="whitespace-nowrap">
                                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell className="capitalize">
                                  {log.provider.replace("_", " ")}
                                </TableCell>
                                <TableCell className="capitalize">{log.tipo}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getLogStatusIcon(log.status)}
                                    <span className="capitalize">{log.status}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {log.registros_criados > 0 && (
                                    <span className="text-green-600">+{log.registros_criados}</span>
                                  )}
                                  {log.registros_atualizados > 0 && (
                                    <span className="text-blue-600 ml-1">~{log.registros_atualizados}</span>
                                  )}
                                  {log.registros_erro > 0 && (
                                    <span className="text-destructive ml-1">!{log.registros_erro}</span>
                                  )}
                                  {log.registros_processados === 0 && "-"}
                                </TableCell>
                                <TableCell>
                                  {log.duracao_ms ? `${log.duracao_ms}ms` : "-"}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {log.mensagem || "-"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
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
