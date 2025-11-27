import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertItem } from './AlertItem';
import { AssistantSettings } from './AssistantSettings';
import { useAssistantAlerts } from '@/hooks/useAssistantAlerts';
import { RefreshCw, Bell, History, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssistantPanel({ open, onOpenChange }: AssistantPanelProps) {
  const {
    activeAlerts,
    resolvedAlerts,
    config,
    isLoading,
    markAsResolved,
    dismissAlert,
    updateConfig,
    refreshAlerts,
    toggleCategory
  } = useAssistantAlerts();

  const criticalCount = activeAlerts.filter(a => a.priority === 'critical').length;
  const highCount = activeAlerts.filter(a => a.priority === 'high').length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 pb-0 space-y-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">Assistente Inteligente</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Monitoramento em tempo real
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshAlerts}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </SheetHeader>

        {/* Summary Badges */}
        {(criticalCount > 0 || highCount > 0) && (
          <div className="flex items-center gap-2 px-4 pt-3">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                🚨 {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/30 gap-1">
                ⚠️ {highCount} alto{highCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="active" className="flex-1 flex flex-col mt-4">
          <TabsList className="mx-4 grid grid-cols-3">
            <TabsTrigger value="active" className="gap-1 text-xs">
              <Bell className="h-3 w-3" />
              Ativos
              {activeAlerts.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-1">
                  {activeAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1 text-xs">
              <History className="h-3 w-3" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs">
              <Settings className="h-3 w-3" />
              Config
            </TabsTrigger>
          </TabsList>

          {/* Active Alerts */}
          <TabsContent value="active" className="flex-1 mt-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 px-4 py-4">
              {activeAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-success/10 mb-4">
                    <Sparkles className="h-8 w-8 text-success" />
                  </div>
                  <h4 className="font-semibold text-foreground">Tudo em ordem!</h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
                    Não há alertas ativos no momento. Continue assim!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeAlerts.map(alert => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      onResolve={markAsResolved}
                      onDismiss={dismissAlert}
                      onClosePanel={() => onOpenChange(false)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="flex-1 mt-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 px-4 py-4">
              {resolvedAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <History className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h4 className="font-semibold text-foreground">Sem histórico</h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
                    Alertas resolvidos aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {resolvedAlerts.map(alert => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      onResolve={markAsResolved}
                      onDismiss={dismissAlert}
                      onClosePanel={() => onOpenChange(false)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="flex-1 mt-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 px-4 py-4">
              <AssistantSettings
                config={config}
                onToggleCategory={toggleCategory}
                onUpdateConfig={updateConfig}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
