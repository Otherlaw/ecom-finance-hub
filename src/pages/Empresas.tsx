import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
  Trash2,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmpresaFormModal } from "@/components/empresas/EmpresaFormModal";
import { ColaboradoresModal } from "@/components/empresas/ColaboradoresModal";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useIntegracoes } from "@/hooks/useIntegracoes";
import {
  REGIME_TRIBUTARIO_CONFIG,
  canUseICMSCredit,
  RegimeTributario,
} from "@/lib/empresas-data";

const MARKETPLACES_SUPORTADOS = [
  { provider: "mercado_livre", name: "Mercado Livre", color: "hsl(48, 96%, 53%)" },
  { provider: "shopee", name: "Shopee", color: "hsl(16, 100%, 50%)" },
  { provider: "shein", name: "Shein", color: "hsl(0, 0%, 15%)" },
  { provider: "tiktok", name: "TikTok Shop", color: "hsl(0, 0%, 0%)" },
];

export default function Empresas() {
  const navigate = useNavigate();
  const { empresas, isLoading, deleteEmpresa } = useEmpresas();
  const { tokens, isLoading: loadingIntegracoes } = useIntegracoes({});
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<any | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empresaToDelete, setEmpresaToDelete] = useState<any | null>(null);
  const [colaboradoresModalOpen, setColaboradoresModalOpen] = useState(false);
  const [selectedEmpresaForColabs, setSelectedEmpresaForColabs] = useState<any | null>(null);

  const handleEdit = (empresa: any) => {
    setEditingEmpresa(empresa);
    setFormModalOpen(true);
  };

  const handleNew = () => {
    setEditingEmpresa(null);
    setFormModalOpen(true);
  };

  const handleDeleteClick = (empresa: any) => {
    setEmpresaToDelete(empresa);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (empresaToDelete) {
      await deleteEmpresa.mutateAsync(empresaToDelete.id);
      setDeleteDialogOpen(false);
      setEmpresaToDelete(null);
    }
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
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedEmpresaForColabs(empresa);
                              setColaboradoresModalOpen(true);
                            }}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Colaboradores
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(empresa)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
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
        <ModuleCard title="Marketplaces Conectados" description="Integrações por empresa" icon={Store}>
          {loadingIntegracoes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !empresas || empresas.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Cadastre uma empresa para visualizar integrações
            </p>
          ) : (
            <div className="space-y-6">
              {empresas.map((empresa) => {
                const integracoesEmpresa = tokens?.filter(t => t.empresa_id === empresa.id) || [];
                
                return (
                  <div key={empresa.id} className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {empresa.nome_fantasia || empresa.razao_social}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {MARKETPLACES_SUPORTADOS.map((mp) => {
                        const token = integracoesEmpresa.find(t => t.provider === mp.provider);
                        const isExpired = token?.expires_at && new Date(token.expires_at) <= new Date();
                        const isConnected = token && !isExpired;
                        
                        return (
                          <div
                            key={mp.provider}
                            className={`p-4 rounded-xl border ${
                              isConnected 
                                ? "bg-card border-success/30" 
                                : isExpired 
                                  ? "bg-amber-50/50 border-amber-300 dark:bg-amber-950/20"
                                  : "bg-secondary/30 border-dashed"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center" 
                                style={{ backgroundColor: mp.color + "20" }}
                              >
                                <Store className="h-5 w-5" style={{ color: mp.color }} />
                              </div>
                              {isConnected ? (
                                <Badge className="bg-success/10 text-success border-success/20">
                                  Conectado
                                </Badge>
                              ) : isExpired ? (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-400">
                                  Expirado
                                </Badge>
                              ) : (
                                <Badge variant="outline">Não conectado</Badge>
                              )}
                            </div>
                            <h4 className="font-medium">{mp.name}</h4>
                            {isConnected && token?.expires_at ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Expira: {format(new Date(token.expires_at), "dd/MM/yyyy HH:mm")}
                              </p>
                            ) : isExpired ? (
                              <Button 
                                variant="link" 
                                className="p-0 h-auto text-sm text-amber-600"
                                onClick={() => navigate("/integracoes")}
                              >
                                Reconectar
                              </Button>
                            ) : (
                              <Button 
                                variant="link" 
                                className="p-0 h-auto text-sm text-primary"
                                onClick={() => navigate("/integracoes")}
                              >
                                Conectar agora
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ModuleCard>
      </div>

      <EmpresaFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        empresa={editingEmpresa}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa{" "}
              <strong>{empresaToDelete?.nome_fantasia || empresaToDelete?.razao_social}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ColaboradoresModal
        open={colaboradoresModalOpen}
        onOpenChange={setColaboradoresModalOpen}
        empresa={selectedEmpresaForColabs}
      />
    </MainLayout>
  );
}
