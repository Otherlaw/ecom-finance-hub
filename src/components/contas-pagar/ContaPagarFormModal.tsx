import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  ContaPagar, 
  TipoLancamento, 
  FormaPagamento, 
  Periodicidade,
  TIPO_LANCAMENTO, 
  FORMA_PAGAMENTO, 
  PERIODICIDADE_CONFIG,
  mockFornecedores, 
  mockCategorias, 
  mockCentrosCusto,
  validateContaPagar,
  generateParcelas,
  formatCurrency,
} from '@/lib/contas-pagar-data';
import { mockEmpresas, REGIME_TRIBUTARIO_CONFIG } from '@/lib/empresas-data';
import { Building2, CalendarDays, DollarSign, FileText, Repeat, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ContaPagarFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta?: ContaPagar | null;
  onSave: (conta: Partial<ContaPagar>) => void;
}

export function ContaPagarFormModal({ open, onOpenChange, conta, onSave }: ContaPagarFormModalProps) {
  const { toast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<Partial<ContaPagar>>({
    empresaId: '',
    fornecedorId: '',
    descricao: '',
    documento: '',
    tipoLancamento: 'despesa_operacional',
    dataEmissao: new Date().toISOString().split('T')[0],
    dataVencimento: '',
    valorTotal: 0,
    formaPagamento: undefined,
    categoriaId: '',
    centroCustoId: '',
    observacoes: '',
    recorrente: false,
    periodicidade: 'mensal',
  });
  
  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState(2);
  const [previewParcelas, setPreviewParcelas] = useState<Array<{ numero: number; data: string; valor: number }>>([]);

  useEffect(() => {
    if (conta) {
      setFormData({
        ...conta,
      });
      setParcelado(conta.parcelas && conta.parcelas.length > 1);
      setNumeroParcelas(conta.parcelas?.length || 2);
    } else {
      setFormData({
        empresaId: '',
        fornecedorId: '',
        descricao: '',
        documento: '',
        tipoLancamento: 'despesa_operacional',
        dataEmissao: new Date().toISOString().split('T')[0],
        dataVencimento: '',
        valorTotal: 0,
        formaPagamento: undefined,
        categoriaId: '',
        centroCustoId: '',
        observacoes: '',
        recorrente: false,
        periodicidade: 'mensal',
      });
      setParcelado(false);
      setNumeroParcelas(2);
    }
    setErrors({});
    setPreviewParcelas([]);
  }, [conta, open]);

  useEffect(() => {
    if (parcelado && formData.valorTotal && formData.valorTotal > 0 && formData.dataVencimento) {
      const parcelas = generateParcelas(
        formData.valorTotal,
        numeroParcelas,
        formData.dataVencimento,
        formData.periodicidade || 'mensal'
      );
      setPreviewParcelas(parcelas.map(p => ({
        numero: p.numero,
        data: p.dataVencimento,
        valor: p.valorOriginal,
      })));
    } else {
      setPreviewParcelas([]);
    }
  }, [parcelado, numeroParcelas, formData.valorTotal, formData.dataVencimento, formData.periodicidade]);

  const handleSubmit = () => {
    const validation = validateContaPagar(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast({
        title: 'Erro de validação',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    const dataToSave: Partial<ContaPagar> = {
      ...formData,
      valorPago: conta?.valorPago || 0,
      valorEmAberto: formData.valorTotal || 0,
      status: 'em_aberto',
      anexos: conta?.anexos || [],
      parcelas: parcelado ? generateParcelas(
        formData.valorTotal!,
        numeroParcelas,
        formData.dataVencimento!,
        formData.periodicidade || 'mensal'
      ) : [],
      pagamentos: conta?.pagamentos || [],
      conciliado: false,
    };

    onSave(dataToSave);
    onOpenChange(false);
  };

  const selectedEmpresa = mockEmpresas.find(e => e.id === formData.empresaId);

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
                <Label htmlFor="empresaId">Empresa *</Label>
                <Select
                  value={formData.empresaId}
                  onValueChange={(value) => setFormData({ ...formData, empresaId: value })}
                >
                  <SelectTrigger className={errors.empresaId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockEmpresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        <span className="flex items-center gap-2">
                          {empresa.nome}
                          <Badge variant="outline" className="text-xs">
                            {REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].shortLabel}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.empresaId && <p className="text-xs text-red-500">{errors.empresaId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fornecedorId">Fornecedor *</Label>
                <Select
                  value={formData.fornecedorId}
                  onValueChange={(value) => setFormData({ ...formData, fornecedorId: value })}
                >
                  <SelectTrigger className={errors.fornecedorId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockFornecedores.filter(f => f.ativo).map((fornecedor) => (
                      <SelectItem key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fornecedorId && <p className="text-xs text-red-500">{errors.fornecedorId}</p>}
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
                <Label htmlFor="tipoLancamento">Tipo de Lançamento *</Label>
                <Select
                  value={formData.tipoLancamento}
                  onValueChange={(value) => setFormData({ ...formData, tipoLancamento: value as TipoLancamento })}
                >
                  <SelectTrigger className={errors.tipoLancamento ? 'border-red-500' : ''}>
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
                {errors.tipoLancamento && <p className="text-xs text-red-500">{errors.tipoLancamento}</p>}
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
                <Label htmlFor="dataEmissao">Data de Emissão *</Label>
                <Input
                  id="dataEmissao"
                  type="date"
                  value={formData.dataEmissao}
                  onChange={(e) => setFormData({ ...formData, dataEmissao: e.target.value })}
                  className={errors.dataEmissao ? 'border-red-500' : ''}
                />
                {errors.dataEmissao && <p className="text-xs text-red-500">{errors.dataEmissao}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataVencimento">Data de Vencimento *</Label>
                <Input
                  id="dataVencimento"
                  type="date"
                  value={formData.dataVencimento}
                  onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                  className={errors.dataVencimento ? 'border-red-500' : ''}
                />
                {errors.dataVencimento && <p className="text-xs text-red-500">{errors.dataVencimento}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="valorTotal">Valor Total *</Label>
                <Input
                  id="valorTotal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valorTotal || ''}
                  onChange={(e) => setFormData({ ...formData, valorTotal: parseFloat(e.target.value) || 0 })}
                  placeholder="0,00"
                  className={errors.valorTotal ? 'border-red-500' : ''}
                />
                {errors.valorTotal && <p className="text-xs text-red-500">{errors.valorTotal}</p>}
              </div>
            </div>

            {/* Parcelamento */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="parcelado">Parcelar pagamento</Label>
                </div>
                <Switch
                  id="parcelado"
                  checked={parcelado}
                  onCheckedChange={setParcelado}
                />
              </div>

              {parcelado && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numeroParcelas">Número de Parcelas</Label>
                    <Input
                      id="numeroParcelas"
                      type="number"
                      min="2"
                      max="48"
                      value={numeroParcelas}
                      onChange={(e) => setNumeroParcelas(parseInt(e.target.value) || 2)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periodicidade">Periodicidade</Label>
                    <Select
                      value={formData.periodicidade}
                      onValueChange={(value) => setFormData({ ...formData, periodicidade: value as Periodicidade })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PERIODICIDADE_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {previewParcelas.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Prévia das parcelas:</Label>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {previewParcelas.slice(0, 6).map((p) => (
                      <div key={p.numero} className="bg-background rounded p-2 border">
                        <span className="font-medium">{p.numero}ª</span> - {p.data.split('-').reverse().join('/')} - {formatCurrency(p.valor)}
                      </div>
                    ))}
                    {previewParcelas.length > 6 && (
                      <div className="bg-background rounded p-2 border text-muted-foreground">
                        +{previewParcelas.length - 6} parcelas...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seção: Classificação */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Classificação</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoriaId">Categoria Financeira *</Label>
                <Select
                  value={formData.categoriaId}
                  onValueChange={(value) => setFormData({ ...formData, categoriaId: value })}
                >
                  <SelectTrigger className={errors.categoriaId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCategorias.filter(c => c.tipo === 'despesa' && c.ativo).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoriaId && <p className="text-xs text-red-500">{errors.categoriaId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="centroCustoId">Centro de Custo</Label>
                <Select
                  value={formData.centroCustoId || ''}
                  onValueChange={(value) => setFormData({ ...formData, centroCustoId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCentrosCusto.filter(cc => cc.ativo).map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
              <Select
                value={formData.formaPagamento || ''}
                onValueChange={(value) => setFormData({ ...formData, formaPagamento: value as FormaPagamento })}
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
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="recorrente">Despesa recorrente</Label>
              </div>
              <Switch
                id="recorrente"
                checked={formData.recorrente}
                onCheckedChange={(checked) => setFormData({ ...formData, recorrente: checked })}
              />
            </div>

            {formData.recorrente && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-700 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Esta despesa será marcada como recorrente para facilitar o lançamento futuro.
              </div>
            )}
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
              {conta ? 'Salvar Alterações' : 'Criar Conta a Pagar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
