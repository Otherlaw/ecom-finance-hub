/**
 * Modal para cadastro de Certificado Digital A1
 * Agora com validação obrigatória antes de salvar
 */

import { useState, useCallback, useEffect } from "react";
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
import { Upload, Shield, AlertTriangle, Eye, EyeOff, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { useNfeCertificates } from "@/hooks/useNfeSyncStatus";
import { supabase } from "@/integrations/supabase/client";

interface CertificadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  empresaCnpj?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  detail?: string;
  certificate_info?: {
    cnpj: string | null;
    common_name: string | null;
    issuer: string | null;
    valid_from: string;
    valid_to: string;
    is_expired: boolean;
    days_until_expiry: number;
  };
  cnpj_match?: boolean;
}

const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const formatCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export function CertificadoModal({ open, onOpenChange, empresaId, empresaCnpj }: CertificadoModalProps) {
  const [cnpj, setCnpj] = useState("");
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ambiente, setAmbiente] = useState<"producao" | "homologacao">("producao");
  const [uf, setUf] = useState("SP");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const { saveCertificate, certificate } = useNfeCertificates(empresaId);

  // Carregar dados existentes
  useEffect(() => {
    if (certificate) {
      setCnpj(formatCnpj(certificate.cnpj || ""));
      setAmbiente((certificate.ambiente as "producao" | "homologacao") || "producao");
      setUf(certificate.uf || "SP");
    } else if (empresaCnpj && !cnpj) {
      setCnpj(formatCnpj(empresaCnpj));
    }
  }, [certificate, empresaCnpj]);

  // Limpar validação quando arquivo ou senha mudam
  useEffect(() => {
    setValidationResult(null);
  }, [pfxFile, password]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pfx") && !file.name.toLowerCase().endsWith(".p12")) {
      toast.error("Arquivo inválido. Selecione um certificado A1 (.pfx ou .p12)");
      return;
    }

    setPfxFile(file);
    setValidationResult(null);
    toast.success(`Arquivo selecionado: ${file.name}`);
  }, []);

  // Validar certificado via Edge Function
  const validateCertificate = async (pfxBase64: string): Promise<ValidationResult | null> => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await supabase.functions.invoke("validate-certificate", {
        body: {
          pfx_base64: pfxBase64,
          password: password,
          cnpj: cnpj.replace(/\D/g, ""),
          uf: uf,
          environment: ambiente === "producao" ? "production" : "homologation",
        },
      });

      // Checar erro do SDK
      if (response.error) {
        const errorDetail = response.data?.detail
          ? `${response.data?.error || "Erro"}: ${response.data.detail}`
          : (response.data?.error || response.error.message);
        const result: ValidationResult = { valid: false, error: errorDetail };
        setValidationResult(result);
        return result;
      }

      // Verificar se o response.data indica erro
      if (response.data && response.data.valid === false) {
        const errorMsg = response.data.detail
          ? `${response.data.error || "Erro"}: ${response.data.detail}`
          : (response.data.error || "Certificado inválido");
        const result: ValidationResult = { valid: false, error: errorMsg };
        setValidationResult(result);
        return result;
      }

      setValidationResult(response.data);
      return response.data;
    } catch (e: any) {
      const result: ValidationResult = { valid: false, error: e.message || "Erro ao validar certificado" };
      setValidationResult(result);
      return result;
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
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
        // Ler arquivo como ArrayBuffer e converter para base64 puro com chunking
        pfxBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const arrayBuffer = reader.result as ArrayBuffer;
              const bytes = new Uint8Array(arrayBuffer);
              // Converter bytes -> string binária com chunking para evitar travar em arquivos maiores
              const chunkSize = 0x8000;
              const parts: string[] = [];
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                parts.push(String.fromCharCode(...chunk));
              }
              const base64 = btoa(parts.join(""));
              if (!base64) {
                reject(new Error("Não foi possível converter o arquivo para base64"));
                return;
              }
              resolve(base64.replace(/\s/g, ""));
            } catch (err) {
              reject(new Error("Erro ao converter arquivo para base64"));
            }
          };
          reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
          reader.readAsArrayBuffer(pfxFile);
        });

        // VALIDAÇÃO OBRIGATÓRIA antes de salvar
        const validation = await validateCertificate(pfxBase64);

        if (!validation?.valid) {
          setIsLoading(false);
          toast.error(validation?.error || "Certificado inválido");
          return;
        }

        // Mostrar informações extraídas
        if (validation.certificate_info) {
          const info = validation.certificate_info;
          if (info.days_until_expiry <= 30 && info.days_until_expiry > 0) {
            toast.warning(`Atenção: certificado expira em ${info.days_until_expiry} dias`);
          }
        }
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
    setValidationResult(null);
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
            Configure o certificado para sincronização automática de NF-e via SEFAZ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
              O certificado será criptografado e armazenado com segurança.
              Apenas o sistema de sincronização terá acesso aos dados.
            </AlertDescription>
          </Alert>

          {/* CNPJ */}
          <div className="space-y-2">
            <Label htmlFor="modal-cnpj">CNPJ do Certificado *</Label>
            <Input
              id="modal-cnpj"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              maxLength={18}
            />
          </div>

          {/* Arquivo PFX */}
          <div className="space-y-2">
            <Label htmlFor="modal-pfx">Arquivo do Certificado (.pfx ou .p12) *</Label>
            <div className="flex gap-2">
              <Input
                id="modal-pfx"
                type="file"
                accept=".pfx,.p12"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 justify-start"
                onClick={() => document.getElementById("modal-pfx")?.click()}
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
            <Label htmlFor="modal-password">Senha do Certificado *</Label>
            <div className="relative">
              <Input
                id="modal-password"
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

          {/* Resultado da Validação */}
          {validationResult && (
            <Alert className={validationResult.valid 
              ? "bg-success/10 border-success/30" 
              : "bg-destructive/10 border-destructive/30"
            }>
              {validationResult.valid ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              <AlertDescription className={validationResult.valid ? "text-success" : "text-destructive"}>
                {validationResult.valid ? (
                  <div className="space-y-1">
                    <p className="font-medium">Certificado válido!</p>
                    {validationResult.certificate_info && (
                      <div className="text-xs opacity-80">
                        <p>Titular: {validationResult.certificate_info.common_name}</p>
                        <p>CNPJ: {validationResult.certificate_info.cnpj}</p>
                        <p>Válido até: {new Date(validationResult.certificate_info.valid_to).toLocaleDateString("pt-BR")}</p>
                        {validationResult.certificate_info.days_until_expiry <= 30 && (
                          <p className="text-amber-600 font-medium">
                            ⚠ Expira em {validationResult.certificate_info.days_until_expiry} dias
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{validationResult.error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {isValidating && (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Validando certificado...
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || saveCertificate.isPending || isValidating}
          >
            {isLoading || saveCertificate.isPending || isValidating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {isValidating ? "Validando..." : "Salvando..."}
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Salvar Certificado
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
