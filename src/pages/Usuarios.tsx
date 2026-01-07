import { useState } from "react";
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
  UserCog,
  Loader2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUsuarios, Usuario, RoleType } from "@/hooks/useUsuarios";
import { EditarUsuarioModal } from "@/components/usuarios/EditarUsuarioModal";
import { ConvidarUsuarioModal } from "@/components/usuarios/ConvidarUsuarioModal";
import { useAuth } from "@/hooks/useAuth";

const roleLabels: Record<RoleType, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "bg-primary/10 text-primary border-primary/20" },
  financeiro: { label: "Financeiro", color: "bg-info/10 text-info border-info/20" },
  socio: { label: "Sócio", color: "bg-success/10 text-success border-success/20" },
  operador: { label: "Operador", color: "bg-warning/10 text-warning border-warning/20" },
};

export default function Usuarios() {
  const { usuarios, isLoading } = useUsuarios();
  const { isAdmin, loading: authLoading } = useAuth();
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [showConvidar, setShowConvidar] = useState(false);

  const getInitials = (nome: string | null, email: string) => {
    if (nome) {
      return nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const temProblemaAcesso = (user: Usuario) => {
    // Usuário sem empresas vinculadas ou com role operador (não tem acesso financeiro)
    return user.empresas.length === 0 || user.role === "operador";
  };

  // Verificar permissão de admin
  if (!authLoading && !isAdmin) {
    return (
      <MainLayout title="Usuários" subtitle="Gerenciamento de acessos e permissões">
        <div className="flex flex-col items-center justify-center py-20">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Apenas administradores podem gerenciar usuários do sistema.
            Entre em contato com um administrador se precisar de alterações no seu perfil.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Usuários"
      subtitle="Gerenciamento de acessos e permissões"
      actions={
        <Button className="gap-2" onClick={() => setShowConvidar(true)}>
          <Plus className="h-4 w-4" />
          Convidar Usuário
        </Button>
      }
    >
      <ModuleCard
        title="Usuários do Sistema"
        description="Controle de acesso"
        icon={Users}
        noPadding
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum usuário encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Empresas</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(user.nome, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.nome || "Sem nome"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={roleLabels[user.role].color}>
                      <Shield className="h-3 w-3 mr-1" />
                      {roleLabels[user.role].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.empresas.length === 0 ? (
                        <span className="text-sm text-muted-foreground italic">
                          Nenhuma empresa
                        </span>
                      ) : (
                        user.empresas.map((emp) => (
                          <Badge key={emp.id} variant="outline" className="text-xs">
                            {emp.razao_social}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {temProblemaAcesso(user) ? (
                      <Badge className="bg-warning/10 text-warning border-warning/20">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Sem Acesso Financeiro
                      </Badge>
                    ) : (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <Check className="h-3 w-3 mr-1" />
                        Ativo
                      </Badge>
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
                        <DropdownMenuItem onClick={() => setEditando(user)}>
                          <UserCog className="h-4 w-4 mr-2" />
                          Editar Perfil e Empresas
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ModuleCard>

      {/* Permissões */}
      <div className="mt-6">
        <ModuleCard title="Níveis de Permissão" description="O que cada perfil pode acessar" icon={Shield}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-semibold">Administrador</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Acesso total ao sistema
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Gerenciar usuários
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Configurar empresas
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Editar todos os dados
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-xl border border-info/20 bg-info/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-info/10">
                  <Shield className="h-5 w-5 text-info" />
                </div>
                <h4 className="font-semibold">Financeiro</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Fechamento mensal
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Relatórios e DRE
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Fluxo de caixa
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Importar OFX/CSV
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-xl border border-success/20 bg-success/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-success/10">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <h4 className="font-semibold">Sócio</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Dashboard executivo
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  KPIs e projeções
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Relatórios (leitura)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Importar dados
                </li>
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
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Acesso limitado
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Sem acesso financeiro
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Não pode importar OFX
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Visualização básica
                </li>
              </ul>
            </div>
          </div>
        </ModuleCard>
      </div>

      {/* Modal de Edição */}
      <EditarUsuarioModal
        usuario={editando}
        open={!!editando}
        onOpenChange={(open) => !open && setEditando(null)}
      />

      {/* Modal de Convidar */}
      <ConvidarUsuarioModal
        open={showConvidar}
        onOpenChange={setShowConvidar}
      />
    </MainLayout>
  );
}
