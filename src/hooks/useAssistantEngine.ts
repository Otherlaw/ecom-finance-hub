import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AssistantAlert, 
  AssistantConfig, 
  AlertStatus,
} from '@/lib/assistant-data';

interface UseAssistantEngineReturn {
  alerts: AssistantAlert[];
  newAlerts: AssistantAlert[];
  config: AssistantConfig;
  isAnalyzing: boolean;
  lastAnalysis: Date | null;
  dismissAlert: (alertId: string) => void;
  markAsRead: (alertId: string) => void;
  updateAlertStatus: (alertId: string, status: AlertStatus) => void;
  silenceFor: (minutes: number) => void;
  unsilence: () => void;
  runAnalysis: () => void;
  clearNewAlerts: () => void;
  getUnreadCount: () => number;
  getAlertsByCategory: (category: string) => AssistantAlert[];
  getAlertsByStatus: (status: AlertStatus) => AssistantAlert[];
}

const DEFAULT_CONFIG: AssistantConfig = {
  silenciado: false,
  alertasAtivos: true,
  categoriasAtivas: ['fiscal', 'tributario', 'financeiro', 'operacional', 'contabil', 'checklist', 'notas_fiscais'],
  severidadesMinimas: ['critico', 'alto', 'medio', 'baixo', 'informativo'],
  intervaloAnalise: 5,
};

export function useAssistantEngine(): UseAssistantEngineReturn {
  // Iniciar com listas vazias - sem dados mock
  const [alerts, setAlerts] = useState<AssistantAlert[]>([]);
  const [newAlerts, setNewAlerts] = useState<AssistantAlert[]>([]);
  const [config, setConfig] = useState<AssistantConfig>(DEFAULT_CONFIG);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar sem dados mock
  useEffect(() => {
    if (!initialized) {
      // Alertas reais virão de análise futura do banco
      // Por enquanto, começar vazio
      setAlerts([]);
      setNewAlerts([]);
      setInitialized(true);
      setLastAnalysis(new Date());
    }
  }, [initialized]);

  // Verificar se está silenciado
  const isSilenced = useCallback((): boolean => {
    if (!config.silenciado) return false;
    if (!config.silenciadoAte) return false;
    return new Date() < config.silenciadoAte;
  }, [config.silenciado, config.silenciadoAte]);

  // Executar análise (futuramente consultará dados reais)
  const runAnalysis = useCallback(() => {
    if (isSilenced() || !config.alertasAtivos) return;

    setIsAnalyzing(true);

    // Simular análise - em produção, consultará dados reais do banco
    setTimeout(() => {
      setIsAnalyzing(false);
      setLastAnalysis(new Date());
      
      // TODO: Implementar análise real:
      // - Verificar créditos de ICMS vs débitos
      // - Verificar checklists pendentes
      // - Analisar fluxo de caixa
      // - Detectar pagamentos duplicados
      // - Verificar NFs com problemas
      
      console.log('[Fin] Análise concluída às', new Date().toLocaleTimeString());
    }, 1500);
  }, [isSilenced, config.alertasAtivos]);

  // Configurar intervalo de análise
  useEffect(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }

    if (config.alertasAtivos && !isSilenced()) {
      analysisIntervalRef.current = setInterval(() => {
        runAnalysis();
      }, config.intervaloAnalise * 60 * 1000);
    }

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [config.alertasAtivos, config.intervaloAnalise, isSilenced, runAnalysis]);

  // Dispensar alerta do popup
  const dismissAlert = useCallback((alertId: string) => {
    setNewAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Marcar como lido
  const markAsRead = useCallback((alertId: string) => {
    setNewAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Atualizar status do alerta
  const updateAlertStatus = useCallback((alertId: string, status: AlertStatus) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { 
            ...alert, 
            status, 
            dataAtualizacao: new Date(),
            ...(status === 'resolvido' ? { dataResolucao: new Date() } : {})
          } 
        : alert
    ));
    
    // Remover dos novos se foi resolvido ou ignorado
    if (status === 'resolvido' || status === 'ignorado') {
      setNewAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  }, []);

  // Silenciar por X minutos
  const silenceFor = useCallback((minutes: number) => {
    const silenciadoAte = new Date();
    silenciadoAte.setMinutes(silenciadoAte.getMinutes() + minutes);
    
    setConfig(prev => ({
      ...prev,
      silenciado: true,
      silenciadoAte,
    }));
  }, []);

  // Remover silenciamento
  const unsilence = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      silenciado: false,
      silenciadoAte: undefined,
    }));
  }, []);

  // Limpar alertas novos
  const clearNewAlerts = useCallback(() => {
    setNewAlerts([]);
  }, []);

  // Contar não lidos
  const getUnreadCount = useCallback((): number => {
    return alerts.filter(a => a.status === 'novo').length;
  }, [alerts]);

  // Filtrar por categoria
  const getAlertsByCategory = useCallback((category: string): AssistantAlert[] => {
    return alerts.filter(a => a.categoria === category);
  }, [alerts]);

  // Filtrar por status
  const getAlertsByStatus = useCallback((status: AlertStatus): AssistantAlert[] => {
    return alerts.filter(a => a.status === status);
  }, [alerts]);

  return {
    alerts,
    newAlerts,
    config,
    isAnalyzing,
    lastAnalysis,
    dismissAlert,
    markAsRead,
    updateAlertStatus,
    silenceFor,
    unsilence,
    runAnalysis,
    clearNewAlerts,
    getUnreadCount,
    getAlertsByCategory,
    getAlertsByStatus,
  };
}
