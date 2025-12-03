import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContaReceber } from '@/hooks/useContasReceber';
import { useEmpresas } from '@/hooks/useEmpresas';
import { useCategoriasFinanceiras } from '@/hooks/useCategoriasFinanceiras';
import { useCentrosCusto } from '@/hooks/useCentrosCusto';
import { Loader2 } from 'lucide-react';

interface ContaReceberFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaReceber | null;
  onSave: (data: Partial<ContaReceber>) => Promise<void>;
}

export function ContaReceberFormModal({ open, onOpenChange, conta, onSave }: ContaReceberFormModalProps) {
  const { empresas } = useEmpresas();
  const { categorias } = useCategoriasFinanceiras();
  const { centrosCusto } = useCentrosCusto();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    empresa_id: '',
    cliente_nome: '',
    descricao: '',
    documento: '',
    origem: 'outro',
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    valor_total: '',
    categoria_id: '',
    centro_custo_id: '',
    forma_recebimento: '',
    observacoes: '',
  });

  useEffect(() => {
    if (conta) {
      setFormData({
        empresa_id: conta.empresa_id,
        cliente_nome: conta.cliente_nome,
        descricao: conta.descricao,
        documento: conta.documento || '',
        origem: conta.origem || 'outro',
        data_emissao: conta.data_emissao,
        data_vencimento: conta.data_vencimento,
        valor_total: conta.valor_total.toString(),
        categoria_id: conta.categoria_id || '',
        centro_custo_id: conta.centro_custo_id || '',
        forma_recebimento: conta.forma_recebimento || '',
        observacoes: conta.observacoes || '',
      });
    } else {
      setFormData({
        empresa_id: empresas?.[0]?.id || '',
        cliente_nome: '',
        descricao: '',
        documento: '',
        origem: 'outro',
        data_emissao: new Date().toISOString().split('T')[0],
        data_vencimento: '',
        valor_total: '',
        categoria_id: '',
        centro_custo_id: '',
        forma_recebimento: '',
        observacoes: '',
      });
    }
  }, [conta, empresas, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const valorTotal = parseFloat(formData.valor_total);
      await onSave({
        empresa_id: formData.empresa_id,
        cliente_nome: formData.cliente_nome,
        descricao: formData.descricao,
        documento: formData.documento || null,
        origem: formData.origem,
        tipo_lancamento: 'receita_venda',
        data_emissao: formData.data_emissao,
        data_vencimento: formData.data_vencimento,
        valor_total: valorTotal,
        valor_em_aberto: conta ? conta.valor_em_aberto : valorTotal,
        valor_recebido: conta ? conta.valor_recebido : 0,
        categoria_id: formData.categoria_id || null,
        centro_custo_id: formData.centro_custo_id || null,
        forma_recebimento: formData.forma_recebimento || null,
        observacoes: formData.observacoes || null,
        status: conta?.status || 'em_aberto',
        recorrente: false,
        conciliado: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtrar categorias do tipo Receitas
  const categoriasReceitas = categorias?.filter(c => c.tipo === 'Receitas') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{conta ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select value={formData.empresa_id} onValueChange={(v) => setFormData({ ...formData, empresa_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {empresas?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={formData.origem} onValueChange={(v) => setFormData({ ...formData, origem: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="shein">Shein</SelectItem>
                  <SelectItem value="tiktok">TikTok Shop</SelectItem>
                  <SelectItem value="banco">Banco</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Input
              value={formData.cliente_nome}
              onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
              placeholder="Nome do cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição do recebimento"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Documento</Label>
              <Input
                value={formData.documento}
                onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                placeholder="Nº do documento"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Total *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_total}
                onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Emissão *</Label>
              <Input
                type="date"
                value={formData.data_emissao}
                onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Data Vencimento *</Label>
              <Input
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria Financeira</Label>
              <Select value={formData.categoria_id} onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {categoriasReceitas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select value={formData.centro_custo_id} onValueChange={(v) => setFormData({ ...formData, centro_custo_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {centrosCusto?.filter(cc => cc.ativo).map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.codigo ? `${cc.codigo} - ` : ''}{cc.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de Recebimento</Label>
            <Select value={formData.forma_recebimento} onValueChange={(v) => setFormData({ ...formData, forma_recebimento: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Não definido</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="marketplace">Repasse Marketplace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações adicionais"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {conta ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
