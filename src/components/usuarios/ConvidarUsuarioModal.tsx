import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserPlus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/useEmpresas";
import { RoleType } from "@/hooks/useUsuarios";
import { useQueryClient } from "@tanstack/react-query";

interface ConvidarUsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleOptions: { value: RoleType; label: string; description: string }[] = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema" },
  { value: "financeiro", label: "Financeiro", description: "Acesso a fechamento, DRE, fluxo de caixa" },
  { value: "socio", label: "Sócio", description: "Dashboard, KPIs e relatórios" },
  { value: "operador", label: "Operador", description: "Acesso limitado, sem dados financeiros" },
];

export function ConvidarUsuarioModal({
  open,
  onOpenChange,
}: ConvidarUsuarioModalProps) {
  const queryClient = useQueryClient();
  const { empresas } = useEmpresas();
  
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleType>("financeiro");
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [foundUser, setFoundUser] = useState<{ id: string; nome: string | null } | null>(null);

  const handleBuscarUsuario = async () => {
    if (!email.trim()) {
      setError("Digite um e-mail válido");
      return;
    }

    setLoading(true);
    setError(null);
    setFoundUser(null);

    try {
      // Buscar usuário pelo email no profiles
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError("Usuário não encontrado. O usuário precisa ter se cadastrado no sistema antes de ser vinculado.");
        return;
      }

      setFoundUser({ id: data.id, nome: data.nome });
    } catch (err) {
      console.error("Erro ao buscar usuário:", err);
      setError("Erro ao buscar usuário. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVincular = async () => {
    if (!foundUser) {
      setError("Busque um usuário primeiro");
      return;
    }

    if (empresasSelecionadas.length === 0) {
      setError("Selecione pelo menos uma empresa");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Upsert role global em user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: foundUser.id, role },
          { onConflict: "user_id" }
        );

      if (roleError) throw roleError;

      // 2. Inserir vínculos com empresas
      const vinculos = empresasSelecionadas.map((empresaId) => ({
        user_id: foundUser.id,
        empresa_id: empresaId,
        role_na_empresa: role === "admin" ? "dono" : role,
      }));

      // Deletar vínculos existentes primeiro para evitar duplicatas
      await supabase
        .from("user_empresas")
        .delete()
        .eq("user_id", foundUser.id);

      const { error: vinculoError } = await supabase
        .from("user_empresas")
        .insert(vinculos);

      if (vinculoError) throw vinculoError;

      // Sucesso
      setSuccess(true);
      toast.success(`Usuário ${foundUser.nome || email} vinculado com sucesso!`);
      
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["user-empresas"] });

      // Fechar modal após delay
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error("Erro ao vincular usuário:", err);
      setError(err.message || "Erro ao vincular usuário");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("financeiro");
    setEmpresasSelecionadas([]);
    setError(null);
    setSuccess(false);
    setFoundUser(null);
    onOpenChange(false);
  };

  const toggleEmpresa = (empresaId: string) => {
    setEmpresasSelecionadas((prev) =>
      prev.includes(empresaId)
        ? prev.filter((id) => id !== empresaId)
        : [...prev, empresaId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Vincular Usuário
          </DialogTitle>
          <DialogDescription>
            Vincule um usuário já cadastrado às empresas e defina suas permissões.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {success ? (
            <Alert className="bg-success/10 border-success/30">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Usuário vinculado com sucesso!
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Buscar usuário por email */}
              <div className="space-y-2">
                <Label>E-mail do Usuário</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="usuario@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !!foundUser}
                  />
                  <Button
                    variant="outline"
                    onClick={handleBuscarUsuario}
                    disabled={loading || !!foundUser}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O usuário precisa ter se cadastrado no sistema antes
                </p>
              </div>

              {/* Erro */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Usuário encontrado */}
              {foundUser && (
                <>
                  <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                    <p className="font-medium text-success">Usuário encontrado!</p>
                    <p className="text-sm text-muted-foreground">
                      {foundUser.nome || email}
                    </p>
                  </div>

                  {/* Seletor de Role */}
                  <div className="space-y-2">
                    <Label>Perfil de Acesso</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as RoleType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex flex-col">
                              <span>{opt.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {roleOptions.find((r) => r.value === role)?.description}
                    </p>
                  </div>

                  {/* Seletor de Empresas */}
                  <div className="space-y-2">
                    <Label>Empresas com Acesso</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {empresas?.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma empresa cadastrada
                        </p>
                      )}
                      {empresas?.map((empresa) => (
                        <div key={empresa.id} className="flex items-center gap-3">
                          <Checkbox
                            id={`emp-${empresa.id}`}
                            checked={empresasSelecionadas.includes(empresa.id)}
                            onCheckedChange={() => toggleEmpresa(empresa.id)}
                          />
                          <label
                            htmlFor={`emp-${empresa.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {empresa.razao_social}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {success ? "Fechar" : "Cancelar"}
          </Button>
          {foundUser && !success && (
            <Button onClick={handleVincular} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Vincular Usuário
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
