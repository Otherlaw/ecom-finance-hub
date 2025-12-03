import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCartoes } from "@/hooks/useCartoes";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import { Loader2 } from "lucide-react";

interface CartaoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartaoId?: string;
}

export function CartaoFormModal({ open, onOpenChange, cartaoId }: CartaoFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("credito");
  
  const { createCartao, updateCartao } = useCartoes();
  const { empresas, isLoading: loadingEmpresas } = useEmpresas();
  const { responsaveis, isLoading: loadingResponsaveis } = useResponsaveis();

  // Limpar estado ao fechar modal
  useEffect(() => {
    if (!open) {
      setEmpresaId("");
      setResponsavelId("");
      setTipo("credito");
    }
  }, [open]);

  // Pré-selecionar empresa e responsável se houver apenas um
  useEffect(() => {
    if (open && empresas && empresas.length === 1 && !empresaId) {
      setEmpresaId(empresas[0].id);
    }
  }, [open, empresas, empresaId]);

  useEffect(() => {
    if (open && responsaveis && responsaveis.length === 1 && !responsavelId) {
      setResponsavelId(responsaveis[0].id);
    }
  }, [open, responsaveis, responsavelId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!empresaId) {
      return;
    }
    
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const cartaoData = {
      empresa_id: empresaId,
      nome: formData.get("nome") as string,
      instituicao_financeira: formData.get("instituicao_financeira") as string,
      tipo: tipo,
      ultimos_digitos: formData.get("ultimos_digitos") as string || null,
      limite_credito: parseFloat(formData.get("limite_credito") as string) || null,
      dia_fechamento: parseInt(formData.get("dia_fechamento") as string),
      dia_vencimento: parseInt(formData.get("dia_vencimento") as string),
      responsavel_id: responsavelId || null,
      observacoes: (formData.get("observacoes") as string) || null,
    };

    try {
      if (cartaoId) {
        await updateCartao.mutateAsync({ id: cartaoId, ...cartaoData });
      } else {
        await createCartao.mutateAsync(cartaoData);
      }
      onOpenChange(false);
    } catch (error: any) {
      // Erro já tratado nos hooks
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cartaoId ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
          <DialogDescription>
            Cadastre as informações do cartão de crédito corporativo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="empresa_id">Empresa / CNPJ *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas?.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome_fantasia || empresa.razao_social} — {empresa.cnpj}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingEmpresas && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando empresas...
              </p>
            )}
            {!loadingEmpresas && (!empresas || empresas.length === 0) && (
              <p className="text-sm text-destructive mt-1">
                Nenhuma empresa cadastrada. Cadastre uma empresa primeiro.
              </p>
            )}
          </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome">Nome/Apelido do Cartão *</Label>
                <Input id="nome" name="nome" placeholder="Ex: Cartão Nubank Op. Exchange" required />
              </div>

              <div>
                <Label htmlFor="instituicao_financeira">Instituição Financeira *</Label>
                <Input id="instituicao_financeira" name="instituicao_financeira" placeholder="Ex: Nubank" required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="limite_credito">Limite de Crédito</Label>
                <Input id="limite_credito" name="limite_credito" type="number" step="0.01" placeholder="0,00" />
              </div>

              <div>
                <Label htmlFor="ultimos_digitos">Últimos 4 dígitos</Label>
                <Input id="ultimos_digitos" name="ultimos_digitos" maxLength={4} placeholder="1234" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dia_fechamento">Dia de Fechamento *</Label>
                <Input id="dia_fechamento" name="dia_fechamento" type="number" min="1" max="31" placeholder="Ex: 15" required />
              </div>

              <div>
                <Label htmlFor="dia_vencimento">Dia de Vencimento *</Label>
                <Input id="dia_vencimento" name="dia_vencimento" type="number" min="1" max="31" placeholder="Ex: 25" required />
              </div>
            </div>

            <div>
              <Label htmlFor="responsavel_id">Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis?.map((responsavel) => (
                    <SelectItem key={responsavel.id} value={responsavel.id}>
                      {responsavel.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" name="observacoes" placeholder="Informações adicionais sobre o cartão" rows={3} />
            </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !empresaId}>
              {loading ? "Salvando..." : cartaoId ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
