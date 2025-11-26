import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Bell,
  Mail,
  FileText,
  Database,
  Shield,
  Palette,
  Save,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Configuracoes() {
  return (
    <MainLayout
      title="Configurações"
      subtitle="Preferências do sistema"
      actions={
        <Button className="gap-2">
          <Save className="h-4 w-4" />
          Salvar Alterações
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notificações */}
        <ModuleCard title="Notificações" icon={Bell}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Alertas de fechamento</Label>
                <p className="text-sm text-muted-foreground">Receber lembrete de fechamento mensal</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Divergências na conciliação</Label>
                <p className="text-sm text-muted-foreground">Notificar quando houver diferenças</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Alerta de ICMS negativo</Label>
                <p className="text-sm text-muted-foreground">Avisar quando crédito estiver baixo</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Relatórios por e-mail</Label>
                <p className="text-sm text-muted-foreground">Receber relatórios semanais</p>
              </div>
              <Switch />
            </div>
          </div>
        </ModuleCard>

        {/* E-mail */}
        <ModuleCard title="Configurações de E-mail" icon={Mail}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail para relatórios</Label>
              <Input placeholder="relatorios@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>E-mail do contador</Label>
              <Input placeholder="contador@contabilidade.com" />
            </div>
            <div className="space-y-2">
              <Label>Frequência de envio</Label>
              <Select defaultValue="semanal">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ModuleCard>

        {/* Relatórios */}
        <ModuleCard title="Relatórios" icon={FileText}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Incluir logo nos relatórios</Label>
                <p className="text-sm text-muted-foreground">Adicionar identidade visual</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Formato padrão de exportação</Label>
              <Select defaultValue="pdf">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select defaultValue="brl">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brl">Real (R$)</SelectItem>
                  <SelectItem value="usd">Dólar (US$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ModuleCard>

        {/* Dados */}
        <ModuleCard title="Dados e Backup" icon={Database}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Backup automático</Label>
                <p className="text-sm text-muted-foreground">Salvar dados automaticamente</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Frequência do backup</Label>
              <Select defaultValue="diario">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-4">
              <Button variant="outline" className="w-full">
                Exportar todos os dados
              </Button>
            </div>
          </div>
        </ModuleCard>

        {/* Segurança */}
        <ModuleCard title="Segurança" icon={Shield}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Autenticação em duas etapas</Label>
                <p className="text-sm text-muted-foreground">Adicionar camada extra de segurança</p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Registro de atividades</Label>
                <p className="text-sm text-muted-foreground">Manter histórico de ações</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Tempo de sessão</Label>
              <Select defaultValue="8h">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hora</SelectItem>
                  <SelectItem value="4h">4 horas</SelectItem>
                  <SelectItem value="8h">8 horas</SelectItem>
                  <SelectItem value="24h">24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ModuleCard>

        {/* Aparência */}
        <ModuleCard title="Aparência" icon={Palette}>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Tema</Label>
              <Select defaultValue="light">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Densidade</Label>
              <Select defaultValue="normal">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compacto</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="comfortable">Confortável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Animações</Label>
                <p className="text-sm text-muted-foreground">Ativar transições suaves</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
