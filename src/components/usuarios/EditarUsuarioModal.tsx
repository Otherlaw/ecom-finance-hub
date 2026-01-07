import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Usuario, RoleType, useUsuarios } from "@/hooks/useUsuarios";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Loader2 } from "lucide-react";

interface EditarUsuarioModalProps {
  usuario: Usuario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleOptions: { value: RoleType; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "financeiro", label: "Financeiro" },
  { value: "socio", label: "Sócio" },
  { value: "operador", label: "Operador" },
];

export function EditarUsuarioModal({
  usuario,
  open,
  onOpenChange,
}: EditarUsuarioModalProps) {
  const { atualizarRole, atualizarEmpresas } = useUsuarios();
  const { empresas } = useEmpresas();
  
  const [role, setRole] = useState<RoleType>("operador");
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (usuario) {
      setRole(usuario.role);
      setEmpresasSelecionadas(usuario.empresas.map((e) => e.id));
    }
  }, [usuario]);

  const handleSave = async () => {
    if (!usuario) return;
    
    setSaving(true);
    try {
      // Atualizar role
      await atualizarRole.mutateAsync({ userId: usuario.id, role });
      
      // Atualizar empresas
      await atualizarEmpresas.mutateAsync({ 
        userId: usuario.id, 
        empresaIds: empresasSelecionadas,
        roleNaEmpresa: role === "admin" ? "dono" : role,
      });
      
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleEmpresa = (empresaId: string) => {
    setEmpresasSelecionadas((prev) =>
      prev.includes(empresaId)
        ? prev.filter((id) => id !== empresaId)
        : [...prev, empresaId]
    );
  };

  if (!usuario) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info do usuário */}
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="font-medium">{usuario.nome || "Sem nome"}</p>
            <p className="text-sm text-muted-foreground">{usuario.email}</p>
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
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "admin" && "Acesso total ao sistema"}
              {role === "financeiro" && "Acesso a fechamento, DRE, fluxo de caixa e conciliações"}
              {role === "socio" && "Acesso a dashboard, KPIs e relatórios (somente leitura)"}
              {role === "operador" && "Acesso limitado - não pode importar dados financeiros"}
            </p>
          </div>

          {/* Seletor de Empresas */}
          <div className="space-y-2">
            <Label>Empresas com Acesso</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {empresas?.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada</p>
              )}
              {empresas?.map((empresa) => (
                <div key={empresa.id} className="flex items-center gap-3">
                  <Checkbox
                    id={empresa.id}
                    checked={empresasSelecionadas.includes(empresa.id)}
                    onCheckedChange={() => toggleEmpresa(empresa.id)}
                  />
                  <label
                    htmlFor={empresa.id}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {empresa.razao_social}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione as empresas que este usuário pode acessar
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
