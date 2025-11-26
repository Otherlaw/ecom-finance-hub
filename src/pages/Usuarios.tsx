import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  Mail,
  Shield,
  MoreVertical,
  Check,
  Clock,
  UserCog,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const usuarios = [
  {
    id: 1,
    nome: "Admin Principal",
    email: "admin@ecomfinance.com",
    role: "admin",
    empresas: ["Exchange", "Inpari"],
    status: "ativo",
    ultimoAcesso: "Agora",
  },
  {
    id: 2,
    nome: "Financeiro",
    email: "financeiro@ecomfinance.com",
    role: "financeiro",
    empresas: ["Exchange", "Inpari"],
    status: "ativo",
    ultimoAcesso: "Há 2 horas",
  },
  {
    id: 3,
    nome: "Sócio Investidor",
    email: "socio@email.com",
    role: "socio",
    empresas: ["Exchange"],
    status: "ativo",
    ultimoAcesso: "Há 3 dias",
  },
  {
    id: 4,
    nome: "Contador",
    email: "contador@contabilidade.com",
    role: "socio",
    empresas: ["Exchange", "Inpari"],
    status: "pendente",
    ultimoAcesso: "Nunca",
  },
];

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "bg-primary/10 text-primary border-primary/20" },
  financeiro: { label: "Financeiro", color: "bg-info/10 text-info border-info/20" },
  socio: { label: "Sócio", color: "bg-success/10 text-success border-success/20" },
};

export default function Usuarios() {
  return (
    <MainLayout
      title="Usuários"
      subtitle="Gerenciamento de acessos e permissões"
      actions={
        <Button className="gap-2">
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
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead>Usuário</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Empresas</TableHead>
              <TableHead>Último Acesso</TableHead>
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
                        {user.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.nome}</p>
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
                    {user.empresas.map((emp) => (
                      <Badge key={emp} variant="outline" className="text-xs">
                        {emp}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {user.ultimoAcesso}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {user.status === "ativo" ? (
                    <Badge className="bg-success/10 text-success border-success/20">
                      <Check className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge className="bg-warning/10 text-warning border-warning/20">
                      <Clock className="h-3 w-3 mr-1" />
                      Pendente
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
                      <DropdownMenuItem>
                        <UserCog className="h-4 w-4 mr-2" />
                        Editar Perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Shield className="h-4 w-4 mr-2" />
                        Permissões
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="h-4 w-4 mr-2" />
                        Reenviar Convite
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>

      {/* Permissões */}
      <div className="mt-6">
        <ModuleCard title="Níveis de Permissão" description="O que cada perfil pode acessar" icon={Shield}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  Conciliação Tiny
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
                  Relatórios (somente leitura)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Exportar dados
                </li>
              </ul>
            </div>
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
