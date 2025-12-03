import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useEmpresas } from '@/hooks/useEmpresas';
import { useCategoriasFinanceiras } from '@/hooks/useCategoriasFinanceiras';
import { useCentrosCusto } from '@/hooks/useCentrosCusto';
import { ContaPagar } from '@/hooks/useContasPagar';
import { Building2, CalendarDays, DollarSign, FileText } from 'lucide-react';

const TIPO_LANCAMENTO = {
  despesa_operacional: { label: 'Despesa Operacional' },
  compra_mercadoria: { label: 'Compra de Mercadoria' },
  imposto: { label: 'Imposto/Tributo' },
  servico: { label: 'Serviço' },
  outro: { label: 'Outro' },
};

const FORMA_PAGAMENTO = {
  pix: { label: 'Pix' },
  boleto: { label: 'Boleto' },
  transferencia: { label: 'Transferência' },
  cartao: { label: 'Cartão' },
  dinheiro: { label: 'Dinheiro' },
  outro: { label: 'Outro' },
};

interface ContaPagarFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta?: ContaPagar | null;
  onSave: (conta: Partial<ContaPagar>) => void;
}

export function ContaPagarFormModal({ open, onOpenChange, conta, onSave }: ContaPagarFormModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Dados reais do Supabase
  const { empresas } = useEmpresas();
  const { categorias, categoriasPorTipo } = useCategoriasFinanceiras();
  const { centrosFlat } = useCentrosCusto();
  
  const [formData, setFormData] = useState({
    empresa_id: '',
    fornecedor_nome: '',
    descricao: '',
    documento: '',
    tipo_lancamento: 'despesa_operacional',
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    valor_total: 0,
    forma_pagamento: '',
    categoria_id: '',
    centro_custo_id: '',
    observacoes: '',
    recorrente: false,
  });

  useEffect(() => {
    if (conta) {
      setFormData({
        empresa_id: conta.empresa_id,
        fornecedor_nome: conta.fornecedor_nome,
        descricao: conta.descricao,
        documento: conta.documento || '',
        tipo_lancamento: conta.tipo_lancamento,
        data_emissao: conta.data_emissao,
        data_vencimento: conta.data_vencimento,
        valor_total: conta.valor_total,
        forma_pagamento: conta.forma_pagamento || '',
        categoria_id: conta.categoria_id || '',
        centro_custo_id: conta.centro_custo_id || '',
        observacoes: conta.observacoes || '',
        recorrente: conta.recorrente,
      });
    } else {
      setFormData({
        empresa_id: empresas?.[0]?.id || '',
        fornecedor_nome: '',
        descricao: '',
        documento: '',
        tipo_lancamento: 'despesa_operacional',
        data_emissao: new Date().toISOString().split('T')[0],
        data_vencimento: '',
        valor_total: 0,
        forma_pagamento: '',
        categoria_id: '',
        centro_custo_id: '',
        observacoes: '',
        recorrente: false,
      });
    }
    setErrors({});
  }, [conta, open, empresas]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.empresa_id) newErrors.empresa_id = 'Empresa é obrigatória';
    if (!formData.fornecedor_nome.trim()) newErrors.fornecedor_nome = 'Fornecedor é obrigatório';
    if (!formData.descricao.trim()) newErrors.descricao = 'Descrição é obrigatória';
    if (!formData.data_emissao) newErrors.data_emissao = 'Data de emissão é obrigatória';
    if (!formData.data_vencimento) newErrors.data_vencimento = 'Data de vencimento é obrigatória';
    if (!formData.valor_total || formData.valor_total <= 0) newErrors.valor_total = 'Valor deve ser maior que zero';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const dataToSave: Partial<ContaPagar> = {
      empresa_id: formData.empresa_id,
      fornecedor_nome: formData.fornecedor_nome,
      descricao: formData.descricao,
      documento: formData.documento || null,
      tipo_lancamento: formData.tipo_lancamento,
      data_emissao: formData.data_emissao,
      data_vencimento: formData.data_vencimento,
      valor_total: formData.valor_total,
      valor_pago: conta?.valor_pago || 0,
      valor_em_aberto: conta ? conta.valor_em_aberto : formData.valor_total,
      status: conta?.status || 'em_aberto',
      forma_pagamento: formData.forma_pagamento || null,
      categoria_id: formData.categoria_id || null,
      centro_custo_id: formData.centro_custo_id || null,
      observacoes: formData.observacoes || null,
      recorrente: formData.recorrente,
      conciliado: conta?.conciliado || false,
    };

    onSave(dataToSave);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {conta ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seção: Dados Principais */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Dados Principais
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="empresa_id">Empresa *</Label>
                <Select
                  value={formData.empresa_id}
                  onValueChange={(value) => setFormData({ ...formData, empresa_id: value })}
                >
                  <SelectTrigger className={errors.empresa_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas?.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome_fantasia || empresa.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.empresa_id && <p className="text-xs text-red-500">{errors.empresa_id}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fornecedor_nome">Fornecedor *</Label>
                <Input
                  id="fornecedor_nome"
                  value={formData.fornecedor_nome}
                  onChange={(e) => setFormData({ ...formData, fornecedor_nome: e.target.value })}
                  placeholder="Nome do fornecedor"
                  className={errors.fornecedor_nome ? 'border-red-500' : ''}
                />
                {errors.fornecedor_nome && <p className="text-xs text-red-500">{errors.fornecedor_nome}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Compra de mercadorias - Lote Nov/2024"
                className={errors.descricao ? 'border-red-500' : ''}
              />
              {errors.descricao && <p className="text-xs text-red-500">{errors.descricao}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documento">Documento (NF, Boleto, etc.)</Label>
                <Input
                  id="documento"
                  value={formData.documento}
                  onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                  placeholder="Ex: NF 12345"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_lancamento">Tipo de Lançamento *</Label>
                <Select
                  value={formData.tipo_lancamento}
                  onValueChange={(value) => setFormData({ ...formData, tipo_lancamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LANCAMENTO).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Seção: Datas e Valores */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Datas e Valores
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_emissao">Data de Emissão *</Label>
                <Input
                  id="data_emissao"
                  type="date"
                  value={formData.data_emissao}
                  onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                  className={errors.data_emissao ? 'border-red-500' : ''}
                />
                {errors.data_emissao && <p className="text-xs text-red-500">{errors.data_emissao}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_vencimento">Data de Vencimento *</Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                  className={errors.data_vencimento ? 'border-red-500' : ''}
                />
                {errors.data_vencimento && <p className="text-xs text-red-500">{errors.data_vencimento}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_total">Valor Total *</Label>
                <Input
                  id="valor_total"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_total || ''}
                  onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })}
                  placeholder="0,00"
                  className={errors.valor_total ? 'border-red-500' : ''}
                />
                {errors.valor_total && <p className="text-xs text-red-500">{errors.valor_total}</p>}
              </div>
            </div>
          </div>

          {/* Seção: Classificação */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Classificação</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria_id">Categoria Financeira</Label>
                <Select
                  value={formData.categoria_id}
                  onValueChange={(value) => setFormData({ ...formData, categoria_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasPorTipo.map((grupo) => (
                      <div key={grupo.tipo}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                          {grupo.tipo}
                        </div>
                        {grupo.categorias.filter(c => c.ativo).map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="centro_custo_id">Centro de Custo</Label>
                <Select
                  value={formData.centro_custo_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, centro_custo_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {centrosFlat.filter(cc => cc.ativo).map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        <div className="flex items-center gap-2">
                          {cc.level > 0 && (
                            <span className="text-muted-foreground">
                              {"—".repeat(cc.level)}
                            </span>
                          )}
                          <span>{cc.nome}</span>
                          {cc.codigo && (
                            <span className="text-xs text-muted-foreground">({cc.codigo})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
              <Select
                value={formData.forma_pagamento || ''}
                onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMA_PAGAMENTO).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seção: Recorrência */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="recorrente">Despesa recorrente</Label>
              </div>
              <Switch
                id="recorrente"
                checked={formData.recorrente}
                onCheckedChange={(checked) => setFormData({ ...formData, recorrente: checked })}
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {conta ? 'Salvar Alterações' : 'Criar Conta'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
