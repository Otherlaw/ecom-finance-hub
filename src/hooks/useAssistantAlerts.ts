import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  AssistantAlert, 
  AssistantConfig, 
  AlertCategory,
  defaultAssistantConfig,
  generateMockAlerts,
  runFiscalChecks,
  runFinancialChecks,
  runChecklistChecks,
  runInvoiceChecks,
  VerificationContext
} from '@/lib/assistant-data';
import { icmsData, kpis, cashFlowData } from '@/lib/mock-data';

interface UseAssistantAlertsReturn {
  alerts: AssistantAlert[];
  activeAlerts: AssistantAlert[];
  resolvedAlerts: AssistantAlert[];
  config: AssistantConfig;
  isLoading: boolean;
  unreadCount: number;
  markAsResolved: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  updateConfig: (newConfig: Partial<AssistantConfig>) => void;
  refreshAlerts: () => void;
  toggleCategory: (category: AlertCategory) => void;
}

export const useAssistantAlerts = (): UseAssistantAlertsReturn => {
  const [alerts, setAlerts] = useState<AssistantAlert[]>([]);
  const [config, setConfig] = useState<AssistantConfig>(defaultAssistantConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [lastVerification, setLastVerification] = useState<Date>(new Date());

  // Build verification context from system data
  const buildVerificationContext = useCallback((): VerificationContext => {
    const lastCashFlow = cashFlowData[cashFlowData.length - 1];
    
    return {
      icmsCreditos: icmsData.creditoDisponivel,
      icmsDebitos: icmsData.icmsDevido,
      saldoFluxoCaixa: lastCashFlow?.saldo ?? 0,
      margemLiquida: kpis.margemLiquida,
      checklistsPendentes: 2, // Mock value
      fechamentosConcluidos: 4, // Mock value
      xmlsSemCredito: 3, // Mock value
      empresaRegime: 'lucro_presumido' // Mock value
    };
  }, []);

  // Run all verification checks
  const runVerifications = useCallback(() => {
    const context = buildVerificationContext();
    const newAlerts: AssistantAlert[] = [];

    // Only run checks for enabled categories
    if (config.enabledCategories.includes('fiscal')) {
      newAlerts.push(...runFiscalChecks(context));
    }
    if (config.enabledCategories.includes('financial')) {
      newAlerts.push(...runFinancialChecks(context));
    }
    if (config.enabledCategories.includes('checklist')) {
      newAlerts.push(...runChecklistChecks(context));
    }
    if (config.enabledCategories.includes('invoice')) {
      newAlerts.push(...runInvoiceChecks(context));
    }

    return newAlerts;
  }, [config.enabledCategories, buildVerificationContext]);

  // Initialize alerts
  useEffect(() => {
    setIsLoading(true);
    // Load mock alerts on mount
    const mockAlerts = generateMockAlerts();
    setAlerts(mockAlerts);
    setIsLoading(false);
  }, []);

  // Periodic verification (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      
      // Only run during allowed hours
      if (hour >= config.allowedHours.start && hour <= config.allowedHours.end) {
        const newAlerts = runVerifications();
        
        // Add new unique alerts
        setAlerts(prev => {
          const existingTitles = new Set(prev.map(a => a.title));
          const uniqueNewAlerts = newAlerts.filter(a => !existingTitles.has(a.title));
          return [...prev, ...uniqueNewAlerts];
        });
        
        setLastVerification(now);
        setConfig(prev => ({ ...prev, lastCheck: now }));
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [config.allowedHours, runVerifications]);

  // Filter alerts by category based on config
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => config.enabledCategories.includes(alert.category));
  }, [alerts, config.enabledCategories]);

  // Separate active and resolved alerts
  const activeAlerts = useMemo(() => {
    return filteredAlerts
      .filter(alert => alert.status === 'active')
      .sort((a, b) => {
        // Sort by priority first, then by date
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }, [filteredAlerts]);

  const resolvedAlerts = useMemo(() => {
    return filteredAlerts
      .filter(alert => alert.status === 'resolved' || alert.status === 'dismissed')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [filteredAlerts]);

  // Unread count (active alerts)
  const unreadCount = useMemo(() => {
    return activeAlerts.filter(a => a.priority === 'critical' || a.priority === 'high').length;
  }, [activeAlerts]);

  // Mark alert as resolved
  const markAsResolved = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, status: 'resolved' as const, resolvedAt: new Date() }
        : alert
    ));
  }, []);

  // Dismiss alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, status: 'dismissed' as const }
        : alert
    ));
  }, []);

  // Update config
  const updateConfig = useCallback((newConfig: Partial<AssistantConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Toggle category
  const toggleCategory = useCallback((category: AlertCategory) => {
    setConfig(prev => {
      const isEnabled = prev.enabledCategories.includes(category);
      return {
        ...prev,
        enabledCategories: isEnabled
          ? prev.enabledCategories.filter(c => c !== category)
          : [...prev.enabledCategories, category]
      };
    });
  }, []);

  // Manual refresh
  const refreshAlerts = useCallback(() => {
    setIsLoading(true);
    const newAlerts = runVerifications();
    
    setAlerts(prev => {
      const existingTitles = new Set(prev.map(a => a.title));
      const uniqueNewAlerts = newAlerts.filter(a => !existingTitles.has(a.title));
      return [...prev, ...uniqueNewAlerts];
    });
    
    setLastVerification(new Date());
    setIsLoading(false);
  }, [runVerifications]);

  return {
    alerts: filteredAlerts,
    activeAlerts,
    resolvedAlerts,
    config,
    isLoading,
    unreadCount,
    markAsResolved,
    dismissAlert,
    updateConfig,
    refreshAlerts,
    toggleCategory
  };
};
