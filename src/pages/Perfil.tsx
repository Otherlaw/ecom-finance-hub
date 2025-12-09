import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresas } from "@/hooks/useEmpresas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Save, LogOut, Building, Shield, Mail, Calendar, Loader2, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  socio: "Sócio",
  operador: "Operador",
};

export default function Perfil() {
  const navigate = useNavigate();
  const { user, profile, roles, loading, isAuthenticated, signOut, updateProfile } = useAuth();
  const { empresas } = useEmpresas();
  
  const [nome, setNome] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [empresaPadraoId, setEmpresaPadraoId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [loading, isAuthenticated, navigate]);

  // Carregar dados do perfil
  useEffect(() => {
    if (profile) {
      setNome(profile.nome || "");
      setAvatarUrl(profile.avatar_url || "");
      setEmpresaPadraoId(profile.empresa_padrao_id || "");
    }
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        nome,
        avatar_url: avatarUrl || null,
        empresa_padrao_id: empresaPadraoId || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      toast.success("Avatar enviado! Clique em Salvar para confirmar.");
    } catch (error: any) {
      toast.error("Erro ao enviar avatar: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <MainLayout title="Meu Perfil" subtitle="Carregando...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const initials = nome
    ? nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <MainLayout
      title="Meu Perfil"
      subtitle="Gerencie suas informações pessoais"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card do Perfil */}
        <ModuleCard title="Informações Pessoais" icon={User}>
          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="w-full space-y-3">
                <Label>Foto de perfil</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {isUploading ? "Enviando..." : "Enviar foto"}
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Formatos: JPG, PNG, GIF. Máximo: 2MB
                </p>
              </div>
            </div>

            <Separator />

            {/* Nome */}
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
              />
            </div>

            {/* Email (readonly) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                E-mail
              </Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado
              </p>
            </div>
          </div>
        </ModuleCard>

        {/* Empresa Padrão */}
        <ModuleCard title="Empresa Padrão" icon={Building}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione a empresa que será carregada automaticamente ao acessar o sistema.
            </p>
            <Select value={empresaPadraoId || "none"} onValueChange={(val) => setEmpresaPadraoId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar empresa..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (selecionar manualmente)</SelectItem>
                {empresas?.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome_fantasia || empresa.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ModuleCard>

        {/* Permissões e Segurança */}
        <ModuleCard title="Permissões" icon={Shield}>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-sm">Seus papéis no sistema</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {roles && roles.length > 0 ? (
                  roles.map((role) => (
                    <Badge key={role.id} variant="secondary">
                      {ROLE_LABELS[role.role] || role.role}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">Sem papel definido</Badge>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Membro desde:</span>
              </div>
              <p className="font-medium">
                {profile?.created_at
                  ? format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : "—"}
              </p>
            </div>

            {profile?.updated_at && (
              <div className="text-xs text-muted-foreground">
                Última atualização: {format(new Date(profile.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
