import { MessageCircleQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AskAssistantButtonProps {
  onClick: () => void;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  contextDescription?: string;
}

export function AskAssistantButton({
  onClick,
  label = 'Perguntar ao Assis.Fin',
  variant = 'outline',
  size = 'sm',
  className,
  contextDescription,
}: AskAssistantButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={cn('gap-2', className)}
      title={contextDescription || 'Abrir chat com o Assis.Fin'}
    >
      <MessageCircleQuestion className="w-4 h-4" />
      {size !== 'icon' && label}
    </Button>
  );
}
