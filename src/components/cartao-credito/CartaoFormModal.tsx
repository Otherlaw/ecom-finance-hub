import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface CartaoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartaoId?: string;
}

export function CartaoFormModal({ open, onOpenChange, cartaoId }: CartaoFormModalProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Implementar integração com Supabase
      toast.success(cartaoId ? "Cartão atualizado com sucesso!" : "Cartão cadastrado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar cartão");
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Cartão *</Label>
              <Input id="nome" placeholder="Ex: Nubank Corporativo" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instituicao">Instituição Financeira *</Label>
              <Input id="instituicao" placeholder="Ex: Nubank" required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select defaultValue="credito">
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limite">Limite de Crédito</Label>
              <Input id="limite" type="number" step="0.01" placeholder="0,00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ultimos_digitos">Últimos 4 dígitos</Label>
              <Input id="ultimos_digitos" maxLength={4} placeholder="1234" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dia_fechamento">Dia de Fechamento *</Label>
              <Input id="dia_fechamento" type="number" min="1" max="31" placeholder="Ex: 15" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dia_vencimento">Dia de Vencimento *</Label>
              <Input id="dia_vencimento" type="number" min="1" max="31" placeholder="Ex: 25" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa *</Label>
              <Select>
                <SelectTrigger id="empresa">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inpari">Inpari</SelectItem>
                  <SelectItem value="exchange">Exchange</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável</Label>
              <Select>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" placeholder="Informações adicionais sobre o cartão" rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : cartaoId ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
