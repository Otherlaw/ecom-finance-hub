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
import { AlertTriangle, Loader2 } from "lucide-react";
import { Usuario } from "@/hooks/useUsuarios";

interface ExcluirUsuarioModalProps {
  usuario: Usuario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ExcluirUsuarioModal({
  usuario,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: ExcluirUsuarioModalProps) {
  if (!usuario) return null;

  const temEmpresas = usuario.empresas.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Usuário Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Você está prestes a excluir o usuário{" "}
                <strong className="text-foreground">{usuario.nome || usuario.email}</strong>.
              </p>

              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-2">
                <p className="font-medium text-destructive">Esta ação é irreversível!</p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>O usuário será removido permanentemente do sistema</li>
                  <li>Todos os vínculos com empresas serão desfeitos</li>
                  {temEmpresas && (
                    <li>
                      <strong className="text-foreground">
                        {usuario.empresas.length} empresa(s) exclusiva(s)
                      </strong>{" "}
                      serão excluídas (se não houver outros membros)
                    </li>
                  )}
                  <li>Dados vinculados ao usuário serão perdidos</li>
                </ul>
              </div>

              {temEmpresas && (
                <div className="text-sm text-muted-foreground">
                  <strong>Empresas vinculadas:</strong>
                  <ul className="mt-1 list-disc list-inside">
                    {usuario.empresas.map((emp) => (
                      <li key={emp.id}>{emp.razao_social}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Sim, Excluir Usuário"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
