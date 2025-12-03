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
  cartaoId?: string | null;
}

export function CartaoFormModal({ open, onOpenChange, cartaoId }: CartaoFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("credito");
  const [nome, setNome] = useState("");
  const [instituicaoFinanceira, setInstituicaoFinanceira] = useState("");
  const [ultimosDigitos, setUltimosDigitos] = useState("");
  const [limiteCredito, setLimiteCredito] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  
  const { cartoes, createCartao, updateCartao } = useCartoes();
  const { empresas, isLoading: loadingEmpresas } = useEmpresas();
  const { responsaveis, isLoading: loadingResponsaveis } = useResponsaveis();

  const isEditing = !!cartaoId;

  // Carregar dados do cartão ao editar
  useEffect(() => {
    if (open && cartaoId && cartoes) {
      const cartao = cartoes.find((c: any) => c.id === cartaoId);
      if (cartao) {
        setEmpresaId(cartao.empresa_id || "");
        setResponsavelId(cartao.responsavel_id || "");
        setTipo(cartao.tipo || "credito");
        setNome(cartao.nome || "");
        setInstituicaoFinanceira(cartao.instituicao_financeira || "");
        setUltimosDigitos(cartao.ultimos_digitos || "");
        setLimiteCredito(cartao.limite_credito?.toString() || "");
        setDiaFechamento(cartao.dia_fechamento?.toString() || "");
        setDiaVencimento(cartao.dia_vencimento?.toString() || "");
        setObservacoes(cartao.observacoes || "");
      }
    }
  }, [open, cartaoId, cartoes]);

  // Limpar estado ao fechar modal
  useEffect(() => {
    if (!open) {
      setEmpresaId("");
      setResponsavelId("");
      setTipo("credito");
      setNome("");
      setInstituicaoFinanceira("");
      setUltimosDigitos("");
      setLimiteCredito("");
      setDiaFechamento("");
      setDiaVencimento("");
      setObservacoes("");
    }
  }, [open]);

  // Pré-selecionar empresa e responsável se houver apenas um (apenas ao criar)
  useEffect(() => {
    if (open && !cartaoId && empresas && empresas.length === 1 && !empresaId) {
      setEmpresaId(empresas[0].id);
    }
  }, [open, cartaoId, empresas, empresaId]);

  useEffect(() => {
    if (open && !cartaoId && responsaveis && responsaveis.length === 1 && !responsavelId) {
      setResponsavelId(responsaveis[0].id);
    }
  }, [open, cartaoId, responsaveis, responsavelId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!empresaId) {
      return;
    }
    
    setLoading(true);

    const cartaoData = {
      empresa_id: empresaId,
      nome: nome,
      instituicao_financeira: instituicaoFinanceira,
      tipo: tipo,
      ultimos_digitos: ultimosDigitos || null,
      limite_credito: parseFloat(limiteCredito) || null,
      dia_fechamento: parseInt(diaFechamento),
      dia_vencimento: parseInt(diaVencimento),
      responsavel_id: responsavelId || null,
      observacoes: observacoes || null,
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
          <DialogTitle>{isEditing ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize as informações do cartão de crédito corporativo" : "Cadastre as informações do cartão de crédito corporativo"}
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
              <Input 
                id="nome" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Cartão Nubank Op. Exchange" 
                required 
              />
            </div>

            <div>
              <Label htmlFor="instituicao_financeira">Instituição Financeira *</Label>
              <Input 
                id="instituicao_financeira" 
                value={instituicaoFinanceira}
                onChange={(e) => setInstituicaoFinanceira(e.target.value)}
                placeholder="Ex: Nubank" 
                required 
              />
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
              <Input 
                id="limite_credito" 
                type="number" 
                step="0.01" 
                value={limiteCredito}
                onChange={(e) => setLimiteCredito(e.target.value)}
                placeholder="0,00" 
              />
            </div>

            <div>
              <Label htmlFor="ultimos_digitos">Últimos 4 dígitos</Label>
              <Input 
                id="ultimos_digitos" 
                maxLength={4} 
                value={ultimosDigitos}
                onChange={(e) => setUltimosDigitos(e.target.value)}
                placeholder="1234" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dia_fechamento">Dia de Fechamento *</Label>
              <Input 
                id="dia_fechamento" 
                type="number" 
                min="1" 
                max="31" 
                value={diaFechamento}
                onChange={(e) => setDiaFechamento(e.target.value)}
                placeholder="Ex: 15" 
                required 
              />
            </div>

            <div>
              <Label htmlFor="dia_vencimento">Dia de Vencimento *</Label>
              <Input 
                id="dia_vencimento" 
                type="number" 
                min="1" 
                max="31" 
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
                placeholder="Ex: 25" 
                required 
              />
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
            <Textarea 
              id="observacoes" 
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais sobre o cartão" 
              rows={3} 
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !empresaId}>
              {loading ? "Salvando..." : isEditing ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}