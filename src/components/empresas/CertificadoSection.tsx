/**
 * Seção de Certificado Digital A1 para o formulário de empresa
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, 
  Upload, 
  Check, 
  AlertTriangle, 
  Eye, 
  EyeOff,
  RefreshCw,
  Trash2 
} from "lucide-react";
import { toast } from "sonner";
import { useNfeCertificates } from "@/hooks/useNfeSyncStatus";
import { supabase } from "@/integrations/supabase/client";

interface CertificadoSectionProps {
  empresaId?: string;
  onCertificateSaved?: () => void;
}

const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function CertificadoSection({ empresaId, onCertificateSaved }: CertificadoSectionProps) {
  const [cnpj, setCnpj] = useState("");
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ambiente, setAmbiente] = useState<"producao" | "homologacao">("producao");
  const [uf, setUf] = useState("SP");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { certificate, saveCertificate, removeCertificate, isLoading: loadingCert } = 
    useNfeCertificates(empresaId);

  // Carregar dados existentes quando certificado for carregado
  useState(() => {
    if (certificate) {
      setCnpj(certificate.cnpj || "");
      setAmbiente((certificate.ambiente as "producao" | "homologacao") || "producao");
      setUf(certificate.uf || "SP");
    }
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pfx") && !file.name.toLowerCase().endsWith(".p12")) {
      toast.error("Arquivo inválido. Selecione um certificado A1 (.pfx ou .p12)");
      return;
    }

    setPfxFile(file);
  }, []);

  const handleSubmit = async () => {
    if (!empresaId) {
      toast.error("Salve a empresa primeiro antes de adicionar o certificado");
      return;
    }

    if (!cnpj || cnpj.length < 14) {
      toast.error("Informe um CNPJ válido");
      return;
    }

    if (!pfxFile && !certificate) {
      toast.error("Selecione o arquivo do certificado");
      return;
    }

    if (!password) {
      toast.error("Informe a senha do certificado");
      return;
    }

    setIsLoading(true);

    try {
      let pfxBase64 = "";

      if (pfxFile) {
        const buffer = await pfxFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        pfxBase64 = btoa(binary);
      }

      await saveCertificate.mutateAsync({
        cnpj: cnpj.replace(/\D/g, ""),
        pfxBase64: pfxBase64 || "EXISTING",
        password,
        ambiente,
        uf,
      });

      // Disparar sincronização automática
      try {
        await supabase.functions.invoke("nfe-sync-request", {
          body: {
            empresa_id: empresaId,
            action: "start",
          },
        });
        toast.success("Sincronização de NF-e iniciada automaticamente");
      } catch (syncError) {
        console.warn("Não foi possível iniciar sync automático:", syncError);
      }

      setIsExpanded(false);
      setPfxFile(null);
      setPassword("");
      onCertificateSaved?.();
    } catch (error) {
      console.error("Erro ao salvar certificado:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!certificate?.id) return;
    
    if (!confirm("Remover o certificado? A sincronização automática de NF-e será desativada.")) {
      return;
    }

    await removeCertificate.mutateAsync(certificate.id);
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  // Se empresa ainda não foi salva
  if (!empresaId) {
    return (
      <div className="pt-4 border-t">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm text-muted-foreground">Certificado Digital A1</h4>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Salve a empresa primeiro para adicionar o certificado digital.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Se já tem certificado
  if (certificate && !isExpanded) {
    return (
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-success" />
            <h4 className="font-medium text-sm">Certificado Digital A1</h4>
          </div>
          <Badge className="bg-success/10 text-success border-success/20">
            <Check className="h-3 w-3 mr-1" />
            Configurado
          </Badge>
        </div>
        
        <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">CNPJ: {formatCnpj(certificate.cnpj || "")}</p>
              <p className="text-xs text-muted-foreground">
                {certificate.ambiente === "producao" ? "Produção" : "Homologação"} • UF: {certificate.uf}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(true)}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Atualizar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={removeCertificate.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Formulário para adicionar/editar
  return (
    <div className="pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm text-muted-foreground">Certificado Digital A1</h4>
        </div>
        {certificate && (
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
            Cancelar
          </Button>
        )}
      </div>

      <div className="space-y-4 bg-secondary/20 rounded-lg p-4">
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
            Configure o certificado A1 para sincronização automática de NF-e via SEFAZ.
            O certificado é criptografado e armazenado com segurança.
          </AlertDescription>
        </Alert>

        {/* CNPJ */}
        <div className="space-y-2">
          <Label htmlFor="cert-cnpj">CNPJ do Certificado *</Label>
          <Input
            id="cert-cnpj"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(formatCnpj(e.target.value))}
            maxLength={18}
          />
        </div>

        {/* Arquivo PFX */}
        <div className="space-y-2">
          <Label htmlFor="pfx-file">Arquivo do Certificado (.pfx ou .p12) *</Label>
          <div className="flex gap-2">
            <Input
              id="pfx-file"
              type="file"
              accept=".pfx,.p12"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => document.getElementById("pfx-file")?.click()}
            >
              <Upload className="h-4 w-4" />
              {pfxFile ? pfxFile.name : certificate ? "Selecionar novo arquivo..." : "Selecionar arquivo..."}
            </Button>
          </div>
          {certificate && !pfxFile && (
            <p className="text-xs text-muted-foreground">
              Certificado já cadastrado. Selecione um novo arquivo para substituir.
            </p>
          )}
        </div>

        {/* Senha */}
        <div className="space-y-2">
          <Label htmlFor="cert-password">Senha do Certificado *</Label>
          <div className="relative">
            <Input
              id="cert-password"
              type={showPassword ? "text" : "password"}
              placeholder="Senha do certificado"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Ambiente e UF */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={ambiente} onValueChange={(v) => setAmbiente(v as "producao" | "homologacao")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="producao">Produção</SelectItem>
                <SelectItem value="homologacao">Homologação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UFS_BRASIL.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || saveCertificate.isPending}
          className="w-full"
        >
          {isLoading || saveCertificate.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Salvar Certificado
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
