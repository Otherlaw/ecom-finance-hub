import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Settings,
  Users,
  Store,
  MoreVertical,
  Check,
  Edit,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmpresaFormModal } from "@/components/empresas/EmpresaFormModal";
import { useEmpresas } from "@/hooks/useEmpresas";
import {
  REGIME_TRIBUTARIO_CONFIG,
  canUseICMSCredit,
  RegimeTributario,
} from "@/lib/empresas-data";

export default function Empresas() {
  const { empresas, isLoading } = useEmpresas();
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<any | null>(null);

  const handleEdit = (empresa: any) => {
    setEditingEmpresa(empresa);
    setFormModalOpen(true);
  };

  const handleNew = () => {
    setEditingEmpresa(null);
    setFormModalOpen(true);
  };

  // Mapear regime_tributario do Supabase para o tipo local
  const getRegimeConfig = (regime: string) => {
    const regimeMap: Record<string, RegimeTributario> = {
      'simples_nacional': 'simples_nacional',
      'lucro_presumido': 'lucro_presumido', 
      'lucro_real': 'lucro_real',
    };
    return REGIME_TRIBUTARIO_CONFIG[regimeMap[regime] || 'lucro_presumido'];
  };

  return (
    <MainLayout
      title="Empresas"
      subtitle="Gerenciamento de empresas e operações"
      actions={
        <Button className="gap-2" onClick={handleNew}>
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      }
    >
      <ModuleCard
        title="Empresas Cadastradas"
        description="Gerencie suas operações"
        icon={Building2}
        noPadding
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando empresas...</span>
          </div>
        ) : !empresas || empresas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">Nenhuma empresa cadastrada ainda.</p>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar primeira empresa
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Regime Tributário</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map((empresa) => {
                const regimeConfig = getRegimeConfig(empresa.regime_tributario);
                const usesICMS = canUseICMSCredit(empresa.regime_tributario as RegimeTributario);

                return (
                  <TableRow key={empresa.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium block">
                            {empresa.nome_fantasia || empresa.razao_social}
                          </span>
                          {empresa.nome_fantasia && (
                            <span className="text-xs text-muted-foreground">
                              {empresa.razao_social}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {empresa.cnpj}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`${regimeConfig.bgColor} ${regimeConfig.color} border`}
                            >
                              {regimeConfig.shortLabel}
                            </Badge>
                            <span className="text-sm">{regimeConfig.label}</span>
                            {!usesICMS && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {usesICMS ? (
                            <p>Esta empresa pode utilizar créditos de ICMS para compensação tributária.</p>
                          ) : (
                            <p>Simples Nacional: créditos de ICMS são apenas para controle interno, não para compensação.</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      {empresa.ativo ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          <Check className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(empresa)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Configurações
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Store className="h-4 w-4 mr-2" />
                            Marketplaces
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Users className="h-4 w-4 mr-2" />
                            Usuários
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ModuleCard>

      {/* Marketplaces Conectados */}
      <div className="mt-6">
        <ModuleCard title="Marketplaces Conectados" description="Integrações ativas" icon={Store}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { name: "Mercado Livre", color: "hsl(48, 96%, 53%)", connected: true },
              { name: "Shopee", color: "hsl(16, 100%, 50%)", connected: true },
              { name: "Shein", color: "hsl(0, 0%, 15%)", connected: true },
              { name: "TikTok Shop", color: "hsl(0, 0%, 0%)", connected: false },
            ].map((mp) => (
              <div
                key={mp.name}
                className={`p-4 rounded-xl border ${
                  mp.connected ? "bg-card border-border" : "bg-secondary/30 border-dashed"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: mp.color + "20" }}>
                    <Store className="h-5 w-5" style={{ color: mp.color }} />
                  </div>
                  {mp.connected ? (
                    <Badge className="bg-success/10 text-success border-success/20">Conectado</Badge>
                  ) : (
                    <Badge variant="outline">Não conectado</Badge>
                  )}
                </div>
                <h4 className="font-medium">{mp.name}</h4>
                {mp.connected ? (
                  <p className="text-sm text-muted-foreground mt-1">Sincronizado</p>
                ) : (
                  <Button variant="link" className="p-0 h-auto text-sm text-primary">
                    Conectar agora
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ModuleCard>
      </div>

      <EmpresaFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        empresa={editingEmpresa}
      />
    </MainLayout>
  );
}
