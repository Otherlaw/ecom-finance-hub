// Fin - Intelligent Financial Assistant Data Types and Configuration
// (Sem dados mock - produção)

export type AlertSeverity = 'critico' | 'alto' | 'medio' | 'baixo' | 'informativo';

export type AlertCategory = 
  | 'fiscal'
  | 'tributario'
  | 'financeiro'
  | 'operacional'
  | 'contabil'
  | 'checklist'
  | 'notas_fiscais';

export type AlertStatus = 'novo' | 'em_analise' | 'resolvido' | 'ignorado';

export interface AssistantAlert {
  id: string;
  titulo: string;
  descricao: string;
  descricaoCompleta: string;
  categoria: AlertCategory;
  severidade: AlertSeverity;
  status: AlertStatus;
  empresa?: string;
  canal?: string;
  dataDeteccao: Date;
  dataAtualizacao?: Date;
  impactoEstimado?: string;
  acaoRecomendada: string;
  linkDestino?: string;
  dadosContexto?: Record<string, any>;
  resolvidoPor?: string;
  dataResolucao?: Date;
}

export interface AssistantConfig {
  silenciado: boolean;
  silenciadoAte?: Date;
  alertasAtivos: boolean;
  categoriasAtivas: AlertCategory[];
  severidadesMinimas: AlertSeverity[];
  intervaloAnalise: number; // em minutos
}

// Categoria labels e cores
export const CATEGORY_CONFIG: Record<AlertCategory, { label: string; color: string; icon: string }> = {
  fiscal: { label: 'Risco Fiscal', color: 'text-red-500', icon: 'AlertTriangle' },
  tributario: { label: 'Risco Tributário', color: 'text-orange-500', icon: 'Receipt' },
  financeiro: { label: 'Risco Financeiro', color: 'text-amber-500', icon: 'TrendingDown' },
  operacional: { label: 'Risco Operacional', color: 'text-yellow-500', icon: 'Settings' },
  contabil: { label: 'Risco Contábil', color: 'text-blue-500', icon: 'FileText' },
  checklist: { label: 'Status Checklist', color: 'text-purple-500', icon: 'CheckSquare' },
  notas_fiscais: { label: 'Notas Fiscais', color: 'text-cyan-500', icon: 'FileSpreadsheet' },
};

export const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; bgColor: string; borderColor: string }> = {
  critico: { label: 'Crítico', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-500' },
  alto: { label: 'Alto', color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-500' },
  medio: { label: 'Médio', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-500' },
  baixo: { label: 'Baixo', color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-500' },
  informativo: { label: 'Info', color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-400' },
};

export const STATUS_CONFIG: Record<AlertStatus, { label: string; color: string }> = {
  novo: { label: 'Novo', color: 'text-red-600' },
  em_analise: { label: 'Em Análise', color: 'text-yellow-600' },
  resolvido: { label: 'Resolvido', color: 'text-green-600' },
  ignorado: { label: 'Ignorado', color: 'text-gray-500' },
};

// Frases do personagem por severidade
export const ASSISTANT_PHRASES: Record<AlertSeverity, string[]> = {
  critico: [
    "⚠️ Atenção urgente! Detectei um problema crítico que precisa de ação imediata.",
    "🚨 Alerta crítico! Isso requer sua atenção agora.",
    "❗ Situação crítica detectada. Recomendo resolver o quanto antes.",
  ],
  alto: [
    "📊 Identifiquei algo importante que merece sua atenção.",
    "⚡ Detectei uma situação de risco alto no sistema.",
    "🔍 Encontrei algo que precisa ser verificado com prioridade.",
  ],
  medio: [
    "📝 Notei algo que vale a pena revisar quando possível.",
    "💡 Tenho uma observação importante para compartilhar.",
    "📋 Detectei uma situação que requer atenção moderada.",
  ],
  baixo: [
    "💬 Apenas uma observação rápida para você.",
    "📌 Notei algo que pode ser útil saber.",
    "ℹ️ Uma dica rápida para otimizar suas operações.",
  ],
  informativo: [
    "📢 Uma informação que pode ser relevante.",
    "✨ Compartilhando um insight sobre seus dados.",
    "📊 Análise concluída com algumas observações.",
  ],
};

// Função para gerar ID único
export const generateAlertId = (): string => {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Função para obter frase aleatória do assistente
export const getAssistantPhrase = (severidade: AlertSeverity): string => {
  const phrases = ASSISTANT_PHRASES[severidade];
  return phrases[Math.floor(Math.random() * phrases.length)];
};

// Função para formatar data relativa
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays} dias atrás`;
  
  return date.toLocaleDateString('pt-BR');
};
