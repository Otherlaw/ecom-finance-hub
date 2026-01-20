import { useState } from "react";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Trash2, Loader2, Crown, Shield, User } from "lucide-react";
import { useMembrosEmpresa } from "@/hooks/useMembrosEmpresa";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operador", label: "Operador" },
];

const ROLE_ICONS: Record<string, React.ReactNode> = {
  dono: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  financeiro: <User className="h-3 w-3" />,
  operador: <User className="h-3 w-3" />,
};

const ROLE_COLORS: Record<string, string> = {
  dono: "bg-amber-100 text-amber-800 border-amber-200",
  admin: "bg-purple-100 text-purple-800 border-purple-200",
  financeiro: "bg-blue-100 text-blue-800 border-blue-200",
  operador: "bg-gray-100 text-gray-800 border-gray-200",
};

export function MembrosEmpresaCard() {
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaSelecionada = empresaAtiva?.id;
  const { membros, isLoading, addMembro, removeMembro } = useMembrosEmpresa();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operador");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddMembro = async () => {
    if (!email.trim()) return;
    setIsAdding(true);
    await addMembro.mutateAsync({ email: email.trim(), role });
    setEmail("");
    setRole("operador");
    setIsAdding(false);
  };

  if (!empresaSelecionada || empresaSelecionada === "todas") {
    return (
      <ModuleCard title="Membros da Empresa" icon={Users}>
        <p className="text-muted-foreground text-sm">
          Selecione uma empresa específica no menu acima para gerenciar membros.
        </p>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard title="Membros da Empresa" icon={Users}>
      <div className="space-y-6">
        {/* Formulário de adicionar membro */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Adicionar Membro
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label htmlFor="email" className="sr-only">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isAdding}
              />
            </div>
            <div>
              <Label htmlFor="role" className="sr-only">
                Função
              </Label>
              <Select value={role} onValueChange={setRole} disabled={isAdding}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                onClick={handleAddMembro}
                disabled={!email.trim() || isAdding}
                className="w-full"
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            O usuário precisa ter uma conta no sistema para ser adicionado.
          </p>
        </div>

        {/* Lista de membros */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : membros.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nenhum membro encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membros.map((membro) => (
                <TableRow key={membro.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {membro.nome || "Sem nome"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {membro.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`gap-1 ${ROLE_COLORS[membro.role_na_empresa] || ROLE_COLORS.operador}`}
                    >
                      {ROLE_ICONS[membro.role_na_empresa] || ROLE_ICONS.operador}
                      {membro.role_na_empresa === "dono"
                        ? "Dono"
                        : membro.role_na_empresa === "admin"
                          ? "Administrador"
                          : membro.role_na_empresa === "financeiro"
                            ? "Financeiro"
                            : "Operador"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {membro.created_at
                      ? format(new Date(membro.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {membro.role_na_empresa !== "dono" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O usuário <strong>{membro.nome || membro.email}</strong>{" "}
                              perderá acesso a esta empresa. Esta ação pode ser desfeita
                              adicionando o usuário novamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeMembro.mutate(membro.user_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </ModuleCard>
  );
}
