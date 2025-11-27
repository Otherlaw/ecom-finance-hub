import { AssistantConfig, AlertCategory, categoryConfig } from '@/lib/assistant-data';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Bell, Clock, Volume2 } from 'lucide-react';

interface AssistantSettingsProps {
  config: AssistantConfig;
  onToggleCategory: (category: AlertCategory) => void;
  onUpdateConfig: (config: Partial<AssistantConfig>) => void;
}

export function AssistantSettings({ 
  config, 
  onToggleCategory, 
  onUpdateConfig 
}: AssistantSettingsProps) {
  const categories: AlertCategory[] = ['fiscal', 'financial', 'checklist', 'closing', 'invoice', 'operational'];

  const sensitivityLabels = {
    low: 'Baixa (poucos alertas)',
    medium: 'Média (balanceado)',
    high: 'Alta (mais alertas)'
  };

  return (
    <div className="space-y-6 p-1">
      {/* Category Toggles */}
      <div>
        <h4 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Categorias de Alertas
        </h4>
        <div className="space-y-3">
          {categories.map(category => {
            const categoryInfo = categoryConfig[category];
            const isEnabled = config.enabledCategories.includes(category);
            
            return (
              <div 
                key={category}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{categoryInfo.icon}</span>
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">
                      {categoryInfo.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {categoryInfo.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => onToggleCategory(category)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Sensitivity */}
      <div>
        <h4 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Sensibilidade
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {sensitivityLabels[config.sensitivity]}
            </span>
          </div>
          <Slider
            value={[config.sensitivity === 'low' ? 0 : config.sensitivity === 'medium' ? 50 : 100]}
            min={0}
            max={100}
            step={50}
            onValueChange={([value]) => {
              const sensitivity = value === 0 ? 'low' : value === 50 ? 'medium' : 'high';
              onUpdateConfig({ sensitivity });
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Baixa</span>
            <span>Média</span>
            <span>Alta</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Notification Hours */}
      <div>
        <h4 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Horário de Notificações
        </h4>
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm">Início</Label>
            <select 
              value={config.allowedHours.start}
              onChange={(e) => onUpdateConfig({ 
                allowedHours: { ...config.allowedHours, start: Number(e.target.value) }
              })}
              className="bg-background border border-border rounded-md px-3 py-1 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Fim</Label>
            <select 
              value={config.allowedHours.end}
              onChange={(e) => onUpdateConfig({ 
                allowedHours: { ...config.allowedHours, end: Number(e.target.value) }
              })}
              className="bg-background border border-border rounded-md px-3 py-1 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Notification Preferences */}
      <div>
        <h4 className="font-semibold text-sm text-foreground mb-4">
          Preferências de Notificação
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <Label className="text-sm cursor-pointer">Pop-ups de alerta</Label>
            <Switch
              checked={config.notifications.popup}
              onCheckedChange={(checked) => onUpdateConfig({
                notifications: { ...config.notifications, popup: checked }
              })}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <Label className="text-sm cursor-pointer">Badge de contagem</Label>
            <Switch
              checked={config.notifications.badge}
              onCheckedChange={(checked) => onUpdateConfig({
                notifications: { ...config.notifications, badge: checked }
              })}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <Label className="text-sm cursor-pointer">Sons (em breve)</Label>
            <Switch
              checked={config.notifications.sound}
              disabled
              onCheckedChange={(checked) => onUpdateConfig({
                notifications: { ...config.notifications, sound: checked }
              })}
            />
          </div>
        </div>
      </div>

      {/* Last Check Info */}
      <div className="pt-4 text-xs text-muted-foreground text-center">
        Última verificação: {config.lastCheck.toLocaleString('pt-BR')}
      </div>
    </div>
  );
}
