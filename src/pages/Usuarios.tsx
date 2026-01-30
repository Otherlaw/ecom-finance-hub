import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  Shield,
  MoreVertical,
  Check,
  Clock,
  Loader2,
  Trash2,
  Building2,
  Filter,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useColaboradores, Colaborador, ROLES_LABELS } from "@/hooks/useColaboradores";
import { ConvidarUsuarioModal } from "@/components/usuarios/ConvidarUsuarioModal";
import { useAuth } from "@/hooks/useAuth";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { useEmpresas } from "@/hooks/useEmpresas";
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

const roleColors: Record<string, string> = {
  dono: "bg-primary/10 text-primary border-primary/20",
  admin: "bg-info/10 text-info border-info/20",
  financeiro: "bg-success/10 text-success border-success/20",
  operador: "bg-warning/10 text-warning border-warning/20",
};

export default function Usuarios() {
  const { user } = useAuth();
  const { userEmpresas } = useUserEmpresas();
  const { empresas } = useEmpresas();
  const [showConvidar, setShowConvidar] = useState(false);
  const [colaboradorParaRemover, setColaboradorParaRemover] = useState<Colaborador | null>(null);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("");

  // Empresas que o usuário é dono ou admin (pode gerenciar colaboradores)
  const empresasGerenciaveis = useMemo(() => {
    if (!userEmpresas || !empresas) return [];
    const gerenciaveis = userEmpresas
      .filter(ue => ue.role_na_empresa === "dono" || ue.role_na_empresa === "admin")
      .map(ue => ue.empresa_id);
    return empresas.filter(e => gerenciaveis.includes(e.id));
  }, [userEmpresas, empresas]);

  // Selecionar primeira empresa automaticamente
  const empresaIdAtual = empresaSelecionada || empresasGerenciaveis[0]?.id || "";
  
  const { colaboradores, isLoading, removerColaborador } = useColaboradores(empresaIdAtual);

  const empresaAtual = empresas?.find(e => e.id === empresaIdAtual);

  const getInitials = (nome: string | null | undefined, email: string | null | undefined) => {
    if (nome) {
      return nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const handleConfirmRemover = () => {
    if (colaboradorParaRemover) {
      removerColaborador.mutate(colaboradorParaRemover.id, {
        onSuccess: () => setColaboradorParaRemover(null),
      });
    }
  };

  // Verificar se pode remover o colaborador (não pode remover a si mesmo, não pode remover dono)
  const podeRemover = (colaborador: Colaborador) => {
    return user?.id !== colaborador.user_id && colaborador.role_na_empresa !== "dono";
  };

  if (empresasGerenciaveis.length === 0) {
    return (
      <MainLayout title="Colaboradores" subtitle="Gerencie o acesso da equipe às suas empresas">
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma empresa para gerenciar</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Você precisa ser dono ou administrador de uma empresa para gerenciar colaboradores.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Colaboradores"
      subtitle="Gerencie o acesso da equipe às suas empresas"
      actions={
        <Button className="gap-2" onClick={() => setShowConvidar(true)}>
          <Plus className="h-4 w-4" />
          Convidar Colaborador
        </Button>
      }
    >
      {/* Filtro por empresa */}
      <div className="mb-6 p-4 rounded-lg bg-secondary/30 border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Empresa:</span>
          </div>
          <Select value={empresaIdAtual} onValueChange={setEmpresaSelecionada}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresasGerenciaveis.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nome_fantasia || emp.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ModuleCard
        title={`Colaboradores - ${empresaAtual?.nome_fantasia || empresaAtual?.razao_social || "Empresa"}`}
        description="Equipe com acesso à empresa selecionada"
        icon={Users}
        noPadding
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : colaboradores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p className="mb-2">Nenhum colaborador encontrado</p>
            <p className="text-sm text-center max-w-md">
              Convide colaboradores clicando em "Convidar Colaborador".
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead>Colaborador</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradores.map((colaborador) => (
                <TableRow key={colaborador.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(colaborador.profile?.nome, colaborador.profile?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{colaborador.profile?.nome || "Sem nome"}</p>
                        <p className="text-sm text-muted-foreground">{colaborador.profile?.email || ""}</p>
                      </div>
                      {user?.id === colaborador.user_id && (
                        <Badge variant="outline" className="text-xs">Você</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={roleColors[colaborador.role_na_empresa] || ""}>
                      <Shield className="h-3 w-3 mr-1" />
                      {ROLES_LABELS[colaborador.role_na_empresa] || colaborador.role_na_empresa}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {podeRemover(colaborador) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setColaboradorParaRemover(colaborador)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover acesso
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ModuleCard>

      {/* Níveis de Permissão */}
      <div className="mt-6">
        <ModuleCard title="Níveis de Permissão" description="O que cada perfil pode acessar" icon={Shield}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-semibold">Proprietário</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Acesso total à empresa</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Gerenciar colaboradores</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Configurar integrações</li>
              </ul>
            </div>
            <div className="p-6 rounded-xl border border-info/20 bg-info/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-info/10">
                  <Shield className="h-5 w-5 text-info" />
                </div>
                <h4 className="font-semibold">Administrador</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Gerenciar colaboradores</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Configurar integrações</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Importar dados</li>
              </ul>
            </div>
            <div className="p-6 rounded-xl border border-success/20 bg-success/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-success/10">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <h4 className="font-semibold">Financeiro</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Fechamento mensal</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Relatórios e DRE</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Fluxo de caixa</li>
              </ul>
            </div>
            <div className="p-6 rounded-xl border border-warning/20 bg-warning/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Shield className="h-5 w-5 text-warning" />
                </div>
                <h4 className="font-semibold">Operador</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Acesso limitado</li>
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Sem acesso financeiro</li>
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Visualização básica</li>
              </ul>
            </div>
          </div>
        </ModuleCard>
      </div>

      <ConvidarUsuarioModal open={showConvidar} onOpenChange={setShowConvidar} />

      <AlertDialog open={!!colaboradorParaRemover} onOpenChange={(open) => !open && setColaboradorParaRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o acesso de{" "}
              <strong>{colaboradorParaRemover?.profile?.nome || colaboradorParaRemover?.profile?.email}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemover}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
