import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCartoes } from "@/hooks/useCartoes";
import { ensureDefaultCompanyAndUser } from "@/lib/mock-cartao";
import { Loader2 } from "lucide-react";

interface CartaoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartaoId?: string;
}

export function CartaoFormModal({ open, onOpenChange, cartaoId }: CartaoFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [initializingData, setInitializingData] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("credito");
  
  const { createCartao, updateCartao } = useCartoes();
  const queryClient = useQueryClient();

  // Garantir dados padrão ao abrir o modal
  useEffect(() => {
    if (open) {
      setInitializingData(true);
      ensureDefaultCompanyAndUser().then(() => {
        // Recarregar listas após garantir dados padrão
        queryClient.invalidateQueries({ queryKey: ["empresas"] });
        queryClient.invalidateQueries({ queryKey: ["responsaveis"] });
        setInitializingData(false);
      });
    } else {
      // Limpar estado ao fechar
      setEmpresaId("");
      setResponsavelId("");
      setTipo("credito");
    }
  }, [open, queryClient]);

  const { data: empresas, isLoading: loadingEmpresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("ativo", true)
        .order("razao_social");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: responsaveis, isLoading: loadingResponsaveis } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Pré-selecionar empresa e responsável se houver apenas um
  useEffect(() => {
    if (empresas && empresas.length === 1 && !empresaId) {
      setEmpresaId(empresas[0].id);
    }
  }, [empresas, empresaId]);

  useEffect(() => {
    if (responsaveis && responsaveis.length === 1 && !responsavelId) {
      setResponsavelId(responsaveis[0].id);
    }
  }, [responsaveis, responsavelId]);

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

  const isDataLoading = initializingData || loadingEmpresas || loadingResponsaveis;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cartaoId ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
          <DialogDescription>
            Cadastre as informações do cartão de crédito corporativo
          </DialogDescription>
        </DialogHeader>

        {isDataLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando dados...</span>
          </div>
        ) : (
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
                      {empresa.razao_social} - {empresa.cnpj}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!empresas || empresas.length === 0) && (
                <p className="text-sm text-destructive mt-1">
                  Nenhuma empresa cadastrada. Aguarde a criação automática.
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
        )}
      </DialogContent>
    </Dialog>
  );
}
