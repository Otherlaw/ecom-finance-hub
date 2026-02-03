/**
 * Modal para cadastro de Certificado Digital A1
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Shield, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useNfeCertificates } from "@/hooks/useNfeSyncStatus";

interface CertificadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
}

const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function CertificadoModal({ open, onOpenChange, empresaId }: CertificadoModalProps) {
  const [cnpj, setCnpj] = useState("");
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ambiente, setAmbiente] = useState<"producao" | "homologacao">("producao");
  const [uf, setUf] = useState("SP");
  const [isLoading, setIsLoading] = useState(false);

  const { saveCertificate, certificate } = useNfeCertificates(empresaId);

  // Carregar dados existentes
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
      toast.error("Arquivo invalido. Selecione um certificado A1 (.pfx ou .p12)");
      return;
    }

    setPfxFile(file);
    toast.success(`Arquivo selecionado: ${file.name}`);
  }, []);

  const handleSubmit = async () => {
    if (!cnpj || cnpj.length < 14) {
      toast.error("Informe um CNPJ valido");
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
        // Converter arquivo para base64
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

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar certificado:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCnpj("");
    setPfxFile(null);
    setPassword("");
    setAmbiente("producao");
    setUf("SP");
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Certificado Digital A1
          </DialogTitle>
          <DialogDescription>
            Configure o certificado para sincronizacao automatica de NF-e via SEFAZ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 text-sm">
              O certificado sera criptografado e armazenado com seguranca.
              Apenas o sistema de sincronizacao tera acesso aos dados.
            </AlertDescription>
          </Alert>

          {/* CNPJ */}
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ do Certificado *</Label>
            <Input
              id="cnpj"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              maxLength={18}
            />
          </div>

          {/* Arquivo PFX */}
          <div className="space-y-2">
            <Label htmlFor="pfx">Arquivo do Certificado (.pfx ou .p12) *</Label>
            <div className="flex gap-2">
              <Input
                id="pfx"
                type="file"
                accept=".pfx,.p12"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full gap-2 justify-start"
                onClick={() => document.getElementById("pfx")?.click()}
              >
                <Upload className="h-4 w-4" />
                {pfxFile ? pfxFile.name : "Selecionar arquivo..."}
              </Button>
            </div>
            {certificate && !pfxFile && (
              <p className="text-xs text-muted-foreground">
                Certificado ja cadastrado. Selecione um novo arquivo para substituir.
              </p>
            )}
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label htmlFor="password">Senha do Certificado *</Label>
            <div className="relative">
              <Input
                id="password"
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
                  <SelectItem value="producao">Producao</SelectItem>
                  <SelectItem value="homologacao">Homologacao</SelectItem>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || saveCertificate.isPending}>
            {isLoading || saveCertificate.isPending ? "Salvando..." : "Salvar Certificado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
