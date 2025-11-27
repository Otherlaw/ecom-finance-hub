import { AlertSeverity } from '@/lib/assistant-data';
import { Bot, Brain, Eye, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantCharacterProps {
  size?: 'sm' | 'md' | 'lg';
  mood?: AlertSeverity | 'neutral' | 'thinking';
  animated?: boolean;
  className?: string;
}

export function AssistantCharacter({ 
  size = 'md', 
  mood = 'neutral',
  animated = true,
  className 
}: AssistantCharacterProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const moodColors = {
    neutral: 'from-primary to-primary/80',
    thinking: 'from-blue-500 to-purple-500',
    critico: 'from-red-500 to-red-600',
    alto: 'from-orange-500 to-orange-600',
    medio: 'from-yellow-500 to-yellow-600',
    baixo: 'from-blue-400 to-blue-500',
    informativo: 'from-gray-400 to-gray-500',
  };

  const moodGlow = {
    neutral: 'shadow-primary/30',
    thinking: 'shadow-blue-500/40',
    critico: 'shadow-red-500/50',
    alto: 'shadow-orange-500/40',
    medio: 'shadow-yellow-500/40',
    baixo: 'shadow-blue-400/30',
    informativo: 'shadow-gray-400/20',
  };

  return (
    <div 
      className={cn(
        'relative flex items-center justify-center rounded-full bg-gradient-to-br shadow-lg',
        sizeClasses[size],
        moodColors[mood],
        moodGlow[mood],
        animated && mood === 'thinking' && 'animate-pulse',
        className
      )}
    >
      {/* Anel externo animado */}
      {animated && (
        <div className={cn(
          'absolute inset-0 rounded-full border-2 border-white/20',
          mood === 'thinking' && 'animate-spin',
          mood === 'critico' && 'animate-ping opacity-30'
        )} />
      )}
      
      {/* Ícone central */}
      <div className="relative z-10 text-white">
        {mood === 'thinking' ? (
          <Brain className={cn(
            size === 'sm' && 'w-4 h-4',
            size === 'md' && 'w-6 h-6',
            size === 'lg' && 'w-8 h-8'
          )} />
        ) : (
          <Bot className={cn(
            size === 'sm' && 'w-4 h-4',
            size === 'md' && 'w-6 h-6',
            size === 'lg' && 'w-8 h-8'
          )} />
        )}
      </div>

      {/* Indicador de atividade */}
      {mood !== 'neutral' && mood !== 'thinking' && (
        <div className={cn(
          'absolute -top-0.5 -right-0.5 rounded-full',
          size === 'sm' && 'w-2 h-2',
          size === 'md' && 'w-3 h-3',
          size === 'lg' && 'w-4 h-4',
          mood === 'critico' && 'bg-red-400 animate-pulse',
          mood === 'alto' && 'bg-orange-400',
          mood === 'medio' && 'bg-yellow-400',
          mood === 'baixo' && 'bg-blue-400',
          mood === 'informativo' && 'bg-gray-400'
        )}>
          {mood === 'critico' && (
            <Sparkles className="w-full h-full text-white p-0.5" />
          )}
        </div>
      )}

      {/* Olhos estilizados (para versão maior) */}
      {size === 'lg' && (
        <div className="absolute top-3 left-0 right-0 flex justify-center gap-2">
          <Eye className="w-2 h-2 text-white/60" />
          <Eye className="w-2 h-2 text-white/60" />
        </div>
      )}
    </div>
  );
}
