import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Plus, Trash2, Crown, Shield, Calculator, User } from "lucide-react";
import { useColaboradores, ROLES_LABELS, Colaborador } from "@/hooks/useColaboradores";
import { useAuth } from "@/hooks/useAuth";

interface ColaboradoresModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: {
    id: string;
    razao_social: string;
    nome_fantasia?: string | null;
  } | null;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  dono: <Crown className="h-4 w-4 text-amber-500" />,
  admin: <Shield className="h-4 w-4 text-blue-500" />,
  financeiro: <Calculator className="h-4 w-4 text-emerald-500" />,
  operador: <User className="h-4 w-4 text-muted-foreground" />,
};

const ROLE_COLORS: Record<string, string> = {
  dono: "bg-amber-100 text-amber-700 border-amber-300",
  admin: "bg-blue-100 text-blue-700 border-blue-300",
  financeiro: "bg-emerald-100 text-emerald-700 border-emerald-300",
  operador: "bg-secondary text-muted-foreground border-border",
};

export function ColaboradoresModal({
  open,
  onOpenChange,
  empresa,
}: ColaboradoresModalProps) {
  const { user } = useAuth();
  const { colaboradores, isLoading, adicionarColaborador, atualizarRole, removerColaborador } =
    useColaboradores(empresa?.id);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Colaborador["role_na_empresa"]>("operador");
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Colaborador | null>(null);

  // Verificar se usuário atual é dono/admin
  const currentUserRole = colaboradores.find((c) => c.user_id === user?.id)?.role_na_empresa;
  const canManage = currentUserRole === "dono" || currentUserRole === "admin";

  const handleAddColaborador = async () => {
    if (!email.trim() || !empresa?.id) return;

    setIsAdding(true);
    try {
      await adicionarColaborador.mutateAsync({
        email: email.trim().toLowerCase(),
        empresaId: empresa.id,
        role,
      });
      setEmail("");
      setRole("operador");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (colaborador: Colaborador) => {
    await removerColaborador.mutateAsync(colaborador.id);
    setDeleteConfirm(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Colaboradores
            </DialogTitle>
            <DialogDescription>
              Gerencie quem tem acesso à empresa{" "}
              <strong>{empresa?.nome_fantasia || empresa?.razao_social}</strong>
            </DialogDescription>
          </DialogHeader>

          {/* Formulário de adição */}
          {canManage && (
            <div className="flex gap-3 p-4 bg-secondary/30 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="email" className="sr-only">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddColaborador()}
                />
              </div>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddColaborador} disabled={isAdding || !email.trim()}>
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Lista de colaboradores */}
          <div className="border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : colaboradores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum colaborador vinculado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead>Desde</TableHead>
                    {canManage && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores.map((colaborador) => {
                    const isCurrentUser = colaborador.user_id === user?.id;
                    const isDono = colaborador.role_na_empresa === "dono";

                    return (
                      <TableRow key={colaborador.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {ROLE_ICONS[colaborador.role_na_empresa]}
                            <div>
                              <span className="font-medium block">
                                {colaborador.profile?.nome || "Sem nome"}
                                {isCurrentUser && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    (você)
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {colaborador.profile?.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManage && !isDono && !isCurrentUser ? (
                            <Select
                              value={colaborador.role_na_empresa}
                              onValueChange={(v) =>
                                atualizarRole.mutate({
                                  vinculoId: colaborador.id,
                                  novoRole: v as Colaborador["role_na_empresa"],
                                })
                              }
                            >
                              <SelectTrigger className="w-36 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="operador">Operador</SelectItem>
                                <SelectItem value="financeiro">Financeiro</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant="outline"
                              className={ROLE_COLORS[colaborador.role_na_empresa]}
                            >
                              {ROLES_LABELS[colaborador.role_na_empresa]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(colaborador.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            {!isDono && !isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirm(colaborador)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1 pt-2">
            <p>
              <strong>Operador:</strong> Acesso básico para importar dados e visualizar relatórios.
            </p>
            <p>
              <strong>Financeiro:</strong> Pode gerenciar contas a pagar/receber, conciliações e
              relatórios.
            </p>
            <p>
              <strong>Administrador:</strong> Acesso total à empresa, incluindo gerenciar
              colaboradores.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de remoção */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.profile?.nome || deleteConfirm?.profile?.email} perderá acesso a esta
              empresa. Esta ação pode ser revertida adicionando-o novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleRemove(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
